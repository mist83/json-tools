# Blazor WebAssembly Handoff

Short answer: no, there is not already a working “no-touch real C# in the browser” Blazor app checked into this repo.

For a non-technical walkthrough of the WASM idea, tradeoffs, and streaming discussion, see [../wasm-explainer.html](../wasm-explainer.html).

If you deploy the repo exactly as it stands today, you will publish the current static HTML/CSS/JS demo. That demo already gives you:

- real .NET behavior in **Hosted API** mode
- real .NET behavior in **Local API** mode
- a privacy-first **Browser Preview** mode that mirrors the API contract in JavaScript

What you do **not** get yet is a real Blazor/WebAssembly host that runs `JsonUtilities` itself inside the browser.

## What To Build Next

Create a new standalone Blazor WebAssembly app that references the existing `JsonUtilities` class library directly and runs the same workflows in-process:

- byte-range scan
- path extraction
- trie indexing
- semantic search
- validation

The clean story is:

1. Keep the request/response shapes aligned with the existing demo API.
2. Move those shapes into a shared contracts project.
3. Add a browser-side adapter that calls `JsonTools` directly instead of making HTTP requests.
4. Publish the Blazor app as static files and serve it from S3 + CloudFront.

## Recommended Repo Shape

Add these projects:

```text
src/
  JsonUtilities/                 # existing core library
  JsonUtilitiesDemo/             # existing ASP.NET Core API + localhost host
  JsonUtilities.Contracts/       # new shared request/response DTOs
  JsonUtilities.Browser/         # new Blazor WebAssembly host
```

Recommended browser project layout:

```text
src/JsonUtilities.Browser/
  Components/
  Pages/
  Services/
    BrowserJsonToolsService.cs
    BrowserFileLoader.cs
  Models/
  wwwroot/
```

## Why This Is The Right Shape

- `JsonUtilities` already contains the real logic worth proving out in-browser.
- The current demo models live under `src/JsonUtilitiesDemo/Models`, which is fine for the API host but awkward for a browser app.
- Pulling the request/response contracts into `JsonUtilities.Contracts` lets both the API and WASM host tell the same story.
- That keeps the public demo, localhost demo, and browser-native demo conceptually aligned instead of building three unrelated UIs.

## Step-By-Step Implementation

### 1. Create the shared contracts project

```bash
dotnet new classlib -n JsonUtilities.Contracts -o src/JsonUtilities.Contracts --framework net8.0
dotnet sln JsonTools.sln add src/JsonUtilities.Contracts/JsonUtilities.Contracts.csproj
```

Move or copy the demo DTOs from `src/JsonUtilitiesDemo/Models/` into the new shared project, then update the API project to reference them:

```bash
dotnet add src/JsonUtilitiesDemo/JsonUtilitiesDemo.csproj reference src/JsonUtilities.Contracts/JsonUtilities.Contracts.csproj
```

Suggested first-pass shared types:

- `ScanRequest`
- `ScanResponse`
- `ScanStats`
- `PathScanRequest`
- `PathScanResponse`
- `TrieIndexRequest`
- `TrieIndexResponse`
- `SemanticSearchRequest`
- `SemanticSearchResponse`
- `SemanticSearchStats`
- `ObjectInfo`

### 2. Create the Blazor WebAssembly host

```bash
dotnet new blazorwasm -n JsonUtilities.Browser -o src/JsonUtilities.Browser --framework net8.0
dotnet sln JsonTools.sln add src/JsonUtilities.Browser/JsonUtilities.Browser.csproj
dotnet add src/JsonUtilities.Browser/JsonUtilities.Browser.csproj reference src/JsonUtilities/JsonUtilities.csproj
dotnet add src/JsonUtilities.Browser/JsonUtilities.Browser.csproj reference src/JsonUtilities.Contracts/JsonUtilities.Contracts.csproj
```

This should be a **standalone** Blazor WebAssembly app, not a hosted ASP.NET Core pair. The point is to publish static files and let CloudFront serve them.

### 3. Add an in-browser service layer

Create a service such as `BrowserJsonToolsService` that mirrors the existing API capabilities without HTTP:

- `ScanAsync(ScanRequest request)`
- `ExtractPathAsync(PathScanRequest request)`
- `BuildTrieAsync(TrieIndexRequest request)`
- `SearchSemanticAsync(SemanticSearchRequest request)`
- `ValidateAsync(...)`

Under the hood, the service should:

- accept uploaded or pasted JSON from the browser
- open it as a `Stream`
- call into `JsonTools` directly
- map the results back into the shared response DTOs

This is the key architectural move: the UI still thinks in terms of the current request/response contract, but the transport becomes in-process rather than HTTP.

### 4. Handle file input in the browser

Use Blazor file upload primitives to read local files without sending them anywhere:

- `InputFile`
- `IBrowserFile.OpenReadStream(...)`

Recommended first-pass guardrails:

- cap the initial file size to something realistic, such as 25-100 MB
- show a visible warning when a file is large enough that browser memory pressure may become a problem
- keep “paste JSON” and “generate dataset” support, since they are already part of the current demo story

Privacy note: the “no upload” story is real as long as the app avoids outbound API calls in this mode.

### 5. Rebuild the current demo flows in Blazor

The easiest migration path is not to invent a new product surface. Recreate the current sections:

- Home
- Byte-Range Scan
- Path Extraction
- Trie Index
- Semantic Search
- Validate JSON

The UI can look different, but the feature mapping should stay obvious so users understand the Blazor host is the same tool, not a side experiment.

### 6. Be honest about parity

Before claiming “exact parity with the server,” verify these specifically inside the WASM host:

- hashes
- UTF-8 validation
- byte offsets
- semantic search result ordering
- large-file behavior

If any of these differ in-browser, keep the claim narrow and explicit until fixed.

## Local Verification Checklist

Use this checklist before pushing or deploying:

```bash
dotnet build JsonTools.sln
dotnet test JsonTools.sln
dotnet publish src/JsonUtilities.Browser/JsonUtilities.Browser.csproj -c Release
```

Then serve the published output locally:

```bash
cd src/JsonUtilities.Browser/bin/Release/net8.0/publish/wwwroot
python3 -m http.server 5971
```

Open `http://localhost:5971` and verify:

1. The app loads without a backend.
2. No uploaded JSON is sent to any remote API.
3. Byte-range scan works on local pasted JSON.
4. Semantic search works on local uploaded JSON.
5. Browser refresh and direct deep-link navigation still work.

If the app uses client-side routes beyond `/`, verify 403/404 fallback behavior through a static host before calling it done.

## Publish Handoff For S3 + CloudFront

This repo cannot deploy from the current environment, but a deployment-capable agent can follow this sequence.

### Recommended deployment model

Use:

- an S3 bucket as the static origin
- CloudFront in front of the bucket
- Origin Access Control (OAC) if the bucket is private

Recommended first rollout:

- deploy the Blazor app on a subdomain or path where it cannot break the current site
- once validated, decide whether it should replace the current JS host or live beside it

### Publish command

```bash
dotnet publish src/JsonUtilities.Browser/JsonUtilities.Browser.csproj -c Release
```

Deploy the contents of:

```text
src/JsonUtilities.Browser/bin/Release/net8.0/publish/wwwroot/
```

to the S3 origin used by CloudFront.

### CloudFront settings to confirm

- `DefaultRootObject` should be `index.html`
- if using client-side routes, configure 403 and 404 fallbacks to `/index.html` with a `200` response
- enable Brotli/Gzip compression
- cache `index.html` conservatively
- cache `_framework/*` aggressively

### Base path rules

If the Blazor app is deployed at the domain root or a subdomain root, keep:

```html
<base href="/" />
```

If it is deployed under a path prefix such as `/wasm/`, update the Blazor app to:

```html
<base href="/wasm/" />
```

and publish it to that matching prefix.

### MIME types to verify

Make sure the static host serves these correctly:

- `.wasm`
- `.js`
- `.json`
- `.css`
- `.dll`
- `.dat`

If these are wrong, the app may fail to boot even though the files uploaded successfully.

## Deployment Options

### Option A: safest rollout

Keep the existing site as-is and publish the Blazor app to a separate path or subdomain first.

This is the recommended first move because it lets you prove:

- performance
- privacy story
- real C# execution in the browser
- semantic-search usefulness

without replacing a working demo.

### Option B: replace the current site

Once the Blazor host is validated, point the existing CloudFront-backed site at the published Blazor assets instead of the current static HTML/JS app.

Do this only after parity and routing are proven, because this is a product-surface swap, not just an infrastructure change.

## Suggested Messaging

Once the WASM host exists and is validated, the honest story becomes:

“JsonUtilities can now run three ways:

- server-backed through the hosted API
- locally through the ASP.NET Core demo on `localhost`
- directly in the browser through a Blazor WebAssembly host for no-upload exploration”

That is a much stronger story than implying the current Browser Preview is already real C#.

## Useful References

- [Host and deploy ASP.NET Core Blazor WebAssembly](https://learn.microsoft.com/en-us/aspnet/core/blazor/host-and-deploy/webassembly/?view=aspnetcore-10.0)
- [JavaScript JSImport/JSExport interop with a WebAssembly Browser App project](https://learn.microsoft.com/en-us/aspnet/core/client-side/dotnet-interop/wasm-browser-app?view=aspnetcore-10.0)
- [Troubleshooting CloudFront response errors](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/troubleshooting-response-errors.html)

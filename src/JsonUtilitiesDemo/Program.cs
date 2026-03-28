using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME")))
{
    builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "JsonUtilities Demo API",
        Version = "v1",
        Description = "High-performance JSON scanning, path extraction, trie indexing, and semantic search API."
    });
});
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();
var staticRootCandidates = new[]
{
    builder.Environment.ContentRootPath,
    Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", ".."))
};
var staticRoot = staticRootCandidates.First(path => File.Exists(Path.Combine(path, "index.html")));
var staticFiles = new PhysicalFileProvider(staticRoot);

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "JsonUtilities Demo API v1");
    options.RoutePrefix = "swagger";
});

app.UseCors();
app.UseAuthorization();
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    service = "JsonUtilitiesDemo",
    mode = string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME")) ? "local" : "lambda"
}));

app.UseDefaultFiles(new DefaultFilesOptions
{
    FileProvider = staticFiles
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = staticFiles
});
app.MapControllers();
app.MapFallback(async context =>
{
    if (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/swagger"))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    context.Response.ContentType = "text/html; charset=utf-8";
    await context.Response.SendFileAsync(Path.Combine(staticRoot, "index.html"));
});
app.Run();

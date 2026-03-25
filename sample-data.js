// Sample JSON data for JsonUtilities demo examples

const SAMPLE_DATA = {
    // ── Byte-Range Scanning ───────────────────────────────────────────────────
    byteRangeScan: {
        title: "E-commerce Product Catalog",
        description: "Scan multiple collections (products, reviews, orders) and extract objects with precise byte positions and MD5 hashes.",
        json: `{
  "products": [
    {
      "id": "prod-001",
      "name": "Wireless Headphones",
      "price": 79.99,
      "category": "Electronics",
      "inStock": true,
      "rating": 4.5
    },
    {
      "id": "prod-002",
      "name": "Running Shoes",
      "price": 129.99,
      "category": "Sports",
      "inStock": false,
      "rating": 4.8
    },
    {
      "id": "prod-003",
      "name": "Coffee Maker",
      "price": 49.99,
      "category": "Home",
      "inStock": true,
      "rating": 4.2
    }
  ],
  "reviews": [
    {
      "productId": "prod-001",
      "rating": 5,
      "comment": "Excellent sound quality!",
      "author": "John D.",
      "verified": true
    },
    {
      "productId": "prod-002",
      "rating": 4,
      "comment": "Very comfortable for long runs",
      "author": "Sarah M.",
      "verified": true
    }
  ],
  "orders": [
    {
      "orderId": "ord-12345",
      "customerId": "cust-789",
      "items": ["prod-001", "prod-003"],
      "total": 129.98,
      "status": "shipped"
    }
  ]
}`,
        collections: ["products", "reviews", "orders"]
    },

    // ── JSON Path Extraction ──────────────────────────────────────────────────
    jsonPathExtract: {
        title: "Company Org Chart",
        description: "Navigate deeply nested JSON using dot-notation paths to extract specific arrays of objects.",
        json: `{
  "company": {
    "name": "Tech Corp",
    "founded": 2010,
    "departments": {
      "engineering": {
        "headcount": 3,
        "employees": [
          {
            "id": "emp-001",
            "name": "Alice Johnson",
            "role": "Senior Developer",
            "skills": ["JavaScript", "Python", "AWS"],
            "yearsExperience": 8
          },
          {
            "id": "emp-002",
            "name": "Bob Smith",
            "role": "DevOps Engineer",
            "skills": ["Docker", "Kubernetes", "Terraform"],
            "yearsExperience": 5
          },
          {
            "id": "emp-003",
            "name": "Carol White",
            "role": "Frontend Developer",
            "skills": ["React", "TypeScript", "CSS"],
            "yearsExperience": 3
          }
        ]
      },
      "sales": {
        "headcount": 2,
        "employees": [
          {
            "id": "emp-101",
            "name": "David Brown",
            "role": "Account Manager",
            "region": "West Coast",
            "quota": 500000
          },
          {
            "id": "emp-102",
            "name": "Emma Davis",
            "role": "Sales Director",
            "region": "East Coast",
            "quota": 1000000
          }
        ]
      }
    }
  }
}`,
        paths: [
            { path: "company.departments.engineering.employees", description: "Engineering team (3 members)" },
            { path: "company.departments.sales.employees", description: "Sales team (2 members)" }
        ]
    },

    // ── Trie Indexing ─────────────────────────────────────────────────────────
    trieIndex: {
        title: "Blog Posts Collection",
        description: "Index all words and keys from JSON, then search by prefix. Try: 'tech', 'java', 'cloud', 'micro', 'dev'",
        json: `{
  "posts": [
    {
      "id": "post-001",
      "title": "Introduction to Cloud Computing",
      "author": "Jane Developer",
      "tags": ["cloud", "aws", "technology", "infrastructure"],
      "content": "Cloud computing has revolutionized how we build and deploy applications. Modern cloud platforms provide scalable infrastructure.",
      "publishDate": "2024-01-15"
    },
    {
      "id": "post-002",
      "title": "JavaScript Best Practices",
      "author": "John Coder",
      "tags": ["javascript", "programming", "webdev", "frontend"],
      "content": "JavaScript continues to evolve with new features. Understanding modern JavaScript patterns is essential for web development.",
      "publishDate": "2024-02-20"
    },
    {
      "id": "post-003",
      "title": "Microservices Architecture Guide",
      "author": "Sarah Architect",
      "tags": ["microservices", "architecture", "cloud", "containers"],
      "content": "Microservices architecture enables teams to build scalable and maintainable applications. Container technology makes deployment easier.",
      "publishDate": "2024-03-10"
    }
  ]
}`,
        searchTerms: ["tech", "java", "cloud", "micro", "dev", "arch"]
    },

    // ── JSON Validation ───────────────────────────────────────────────────────
    validate: {
        title: "JSON Validation",
        description: "Validate JSON structure and UTF-8 delimiter safety. Checks for balanced braces, valid syntax, and multi-byte character safety.",
        validJson: `{
  "catalog": {
    "version": "2.0",
    "items": [
      { "id": 1, "name": "Widget Alpha", "price": 9.99 },
      { "id": 2, "name": "Widget Beta",  "price": 14.99 }
    ],
    "unicode": "日本語テスト",
    "escaped": "He said \\"hello\\" to her"
  }
}`,
        invalidJson: `{
  "broken": {
    "missing_closing_brace": true,
    "items": [
      { "id": 1, "name": "oops"
    ]
  }
`
    },

    // ── Semantic Search ───────────────────────────────────────────────────────
    semanticSearch: {
        title: "Movie & TV Catalog",
        description: "Build a keyword→byte-offset index from specific fields (title, cast, description). Search returns matching objects without loading the full file.",
        json: `{
  "shows": [
    {
      "id": "show-001",
      "title": "The Shawshank Redemption",
      "year": 1994,
      "genre": ["Drama"],
      "cast": ["Tim Robbins", "Morgan Freeman", "Bob Gunton"],
      "description": "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency."
    },
    {
      "id": "show-002",
      "title": "The Godfather",
      "year": 1972,
      "genre": ["Crime", "Drama"],
      "cast": ["Marlon Brando", "Al Pacino", "James Caan"],
      "description": "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son."
    },
    {
      "id": "show-003",
      "title": "The Dark Knight",
      "year": 2008,
      "genre": ["Action", "Crime", "Drama"],
      "cast": ["Christian Bale", "Heath Ledger", "Aaron Eckhart"],
      "description": "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests."
    },
    {
      "id": "show-004",
      "title": "Forrest Gump",
      "year": 1994,
      "genre": ["Drama", "Romance"],
      "cast": ["Tom Hanks", "Robin Wright", "Gary Sinise"],
      "description": "The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man."
    },
    {
      "id": "show-005",
      "title": "Cast Away",
      "year": 2000,
      "genre": ["Adventure", "Drama"],
      "cast": ["Tom Hanks", "Helen Hunt", "Nick Searcy"],
      "description": "A FedEx executive undergoes a physical and emotional transformation after crash landing on a deserted island."
    }
  ]
}`,
        indexedFields: ["cast", "title", "description"],
        searchTerms: ["hanks", "crime", "dark", "morgan", "drama", "tom"]
    }
};

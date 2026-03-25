// Sample JSON data for JsonUtilities demo examples

const SAMPLE_DATA = {
    // Example 1: E-commerce product catalog with multiple collections
    byteRangeScan: {
        title: "E-commerce Product Catalog",
        description: "Scan multiple collections (products, reviews, orders) and extract objects with byte positions",
        json: `{
  "products": [
    {
      "id": "prod-001",
      "name": "Wireless Headphones",
      "price": 79.99,
      "category": "Electronics",
      "inStock": true
    },
    {
      "id": "prod-002",
      "name": "Running Shoes",
      "price": 129.99,
      "category": "Sports",
      "inStock": false
    },
    {
      "id": "prod-003",
      "name": "Coffee Maker",
      "price": 49.99,
      "category": "Home",
      "inStock": true
    }
  ],
  "reviews": [
    {
      "productId": "prod-001",
      "rating": 5,
      "comment": "Excellent sound quality!",
      "author": "John D."
    },
    {
      "productId": "prod-002",
      "rating": 4,
      "comment": "Very comfortable for long runs",
      "author": "Sarah M."
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

    // Example 2: Nested user data for JSON path extraction
    jsonPathExtract: {
        title: "User Profile with Nested Data",
        description: "Extract specific nested objects using JSON path notation",
        json: `{
  "company": {
    "name": "Tech Corp",
    "departments": {
      "engineering": {
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
            { path: "company.departments.engineering.employees", description: "Engineering team members" },
            { path: "company.departments.sales.employees", description: "Sales team members" }
        ]
    },

    // Example 3: Rich content for Trie indexing
    trieIndex: {
        title: "Blog Posts Collection",
        description: "Index all words and search by prefix (try searching: 'tech', 'java', 'cloud')",
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
        searchTerms: ["tech", "java", "cloud", "micro", "dev"]
    }
};

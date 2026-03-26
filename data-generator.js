// data-generator.js — Client-side fake JSON dataset generator
// ─────────────────────────────────────────────────────────────────────────────

const DataGenerator = (() => {

    // ── Vocabulary pools ─────────────────────────────────────────────────────

    const FIRST_NAMES = ['Alice','Bob','Carol','David','Emma','Frank','Grace','Henry',
        'Iris','Jack','Karen','Leo','Mia','Noah','Olivia','Paul','Quinn','Rachel',
        'Sam','Tina','Uma','Victor','Wendy','Xander','Yara','Zoe','James','Sofia',
        'Liam','Ava','Ethan','Isabella','Mason','Charlotte','Logan','Amelia'];

    const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller',
        'Davis','Wilson','Taylor','Anderson','Thomas','Jackson','White','Harris',
        'Martin','Thompson','Moore','Young','Allen','King','Wright','Scott','Green',
        'Baker','Adams','Nelson','Carter','Mitchell','Perez','Roberts','Turner'];

    const PRODUCT_NAMES = ['Wireless Headphones','Running Shoes','Coffee Maker','Smart Watch',
        'Laptop Stand','Mechanical Keyboard','USB-C Hub','Desk Lamp','Water Bottle',
        'Yoga Mat','Bluetooth Speaker','Phone Case','Webcam','Mouse Pad','Cable Organizer',
        'Monitor Arm','Ergonomic Chair','Standing Desk','Noise Cancelling Earbuds',
        'Portable Charger','Screen Protector','Keyboard Wrist Rest','LED Strip Lights',
        'Air Purifier','Electric Kettle','French Press','Insulated Tumbler','Backpack',
        'Laptop Sleeve','Wireless Charger','Smart Plug','Security Camera','Robot Vacuum'];

    const CATEGORIES = ['Electronics','Sports','Home','Office','Kitchen','Travel','Health',
        'Gaming','Photography','Automotive','Books','Clothing','Garden','Pets'];

    const MOVIE_TITLES = ['The Last Horizon','Midnight Protocol','Echoes of Tomorrow',
        'The Silent Garden','Fractured Light','Beyond the Storm','Iron Meridian',
        'The Forgotten Coast','Parallel Lives','Dark Convergence','The Glass Tower',
        'Ember Falls','Quantum Drift','The Hollow Crown','Neon Requiem',
        'Cascade Effect','The Outer Rim','Broken Symmetry','The Final Accord',
        'Crimson Tide Rising','The Pale Frontier','Shattered Orbit','Lost Signal',
        'The Burning Archive','Void Protocol','Silver Lining','The Deep Current',
        'Fractured Sky','The Iron Veil','Phantom Circuit'];

    const GENRES = ['Action','Drama','Comedy','Thriller','Sci-Fi','Horror','Romance',
        'Documentary','Animation','Crime','Mystery','Adventure','Fantasy','Biography'];

    const BLOG_TOPICS = ['Introduction to Cloud Computing','JavaScript Best Practices',
        'Microservices Architecture Guide','Docker for Beginners','REST API Design',
        'Machine Learning Fundamentals','DevOps Culture and Practices',
        'Kubernetes in Production','GraphQL vs REST','TypeScript Deep Dive',
        'Database Indexing Strategies','CI/CD Pipeline Setup','Security Best Practices',
        'Performance Optimization Tips','Serverless Architecture','Event-Driven Design',
        'Clean Code Principles','Test-Driven Development','Agile Retrospectives',
        'System Design Interviews','Caching Strategies','Message Queue Patterns',
        'Observability and Monitoring','Infrastructure as Code','API Gateway Patterns'];

    const TAGS = ['cloud','aws','javascript','python','docker','kubernetes','devops',
        'microservices','api','database','security','performance','testing','ci-cd',
        'serverless','typescript','react','nodejs','golang','rust','architecture',
        'design-patterns','agile','monitoring','infrastructure'];

    const DEPARTMENTS = ['Engineering','Sales','Marketing','Finance','HR','Operations',
        'Product','Design','Legal','Customer Success','Data Science','DevOps'];

    const JOB_TITLES = ['Senior Engineer','Staff Engineer','Principal Engineer','Engineering Manager',
        'Product Manager','Designer','Data Scientist','DevOps Engineer','QA Engineer',
        'Account Manager','Sales Director','Marketing Manager','Financial Analyst',
        'HR Business Partner','Operations Manager','Customer Success Manager'];

    // ── Utilities ─────────────────────────────────────────────────────────────

    let _seed = Date.now();
    function rand() {
        _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
        return ((_seed >>> 0) / 0xffffffff);
    }
    function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
    function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
    function pickN(arr, n) {
        const shuffled = [...arr].sort(() => rand() - 0.5);
        return shuffled.slice(0, Math.min(n, arr.length));
    }
    function randFloat(min, max, decimals = 2) {
        return parseFloat((rand() * (max - min) + min).toFixed(decimals));
    }
    function randDate(yearsBack = 3) {
        const now = Date.now();
        const past = now - yearsBack * 365 * 24 * 60 * 60 * 1000;
        return new Date(past + rand() * (now - past)).toISOString().split('T')[0];
    }
    function fullName() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }
    function id(prefix, n) { return `${prefix}-${String(n).padStart(5, '0')}`; }

    // ── Generators ────────────────────────────────────────────────────────────

    function generateEcommerce(count) {
        const products = Array.from({ length: count }, (_, i) => ({
            id: id('prod', i + 1),
            name: pick(PRODUCT_NAMES) + (i > PRODUCT_NAMES.length ? ` v${randInt(2, 9)}` : ''),
            price: randFloat(4.99, 499.99),
            category: pick(CATEGORIES),
            inStock: rand() > 0.2,
            rating: randFloat(1, 5, 1),
            reviewCount: randInt(0, 2000),
            sku: `SKU-${randInt(10000, 99999)}`,
            weight: randFloat(0.1, 5.0),
            tags: pickN(TAGS, randInt(1, 4)),
            createdAt: randDate(2)
        }));

        const reviews = Array.from({ length: Math.floor(count * 1.5) }, (_, i) => ({
            id: id('rev', i + 1),
            productId: id('prod', randInt(1, count)),
            rating: randInt(1, 5),
            title: pick(['Great product!', 'Highly recommend', 'Not what I expected',
                'Excellent quality', 'Good value', 'Works as described', 'Amazing!',
                'Disappointed', 'Perfect for my needs', 'Would buy again']),
            comment: `${pick(['Really', 'Absolutely', 'Quite', 'Very', 'Extremely'])} ${pick(['happy', 'satisfied', 'impressed', 'pleased', 'disappointed'])} with this purchase.`,
            author: fullName(),
            verified: rand() > 0.3,
            helpful: randInt(0, 500),
            date: randDate(1)
        }));

        const orders = Array.from({ length: Math.floor(count * 0.8) }, (_, i) => ({
            id: id('ord', i + 1),
            customerId: id('cust', randInt(1, Math.floor(count / 2))),
            items: Array.from({ length: randInt(1, 5) }, () => ({
                productId: id('prod', randInt(1, count)),
                quantity: randInt(1, 4),
                unitPrice: randFloat(4.99, 499.99)
            })),
            total: randFloat(9.99, 999.99),
            status: pick(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
            shippingAddress: {
                city: pick(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
                    'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Seattle']),
                state: pick(['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'WA', 'FL', 'CO', 'OR']),
                zip: String(randInt(10000, 99999))
            },
            createdAt: randDate(1)
        }));

        return { products, reviews, orders };
    }

    function generateMovies(count) {
        const shows = Array.from({ length: count }, (_, i) => ({
            id: id('show', i + 1),
            title: pick(MOVIE_TITLES) + (i > MOVIE_TITLES.length ? ` ${randInt(2, 4)}` : ''),
            year: randInt(1990, 2025),
            genre: pickN(GENRES, randInt(1, 3)),
            rating: randFloat(1, 10, 1),
            votes: randInt(100, 2000000),
            runtime: randInt(75, 180),
            cast: pickN(FIRST_NAMES.map(f => `${f} ${pick(LAST_NAMES)}`), randInt(3, 8)),
            director: fullName(),
            description: `${pick(['A gripping', 'An epic', 'A heartwarming', 'A thrilling', 'A haunting', 'A compelling'])} story about ${pick(['redemption', 'survival', 'love', 'betrayal', 'discovery', 'justice', 'revenge', 'hope'])}.`,
            language: pick(['English', 'Spanish', 'French', 'German', 'Japanese', 'Korean']),
            country: pick(['USA', 'UK', 'France', 'Germany', 'Japan', 'South Korea', 'Canada']),
            releaseDate: randDate(35)
        }));

        const reviews = Array.from({ length: Math.floor(count * 2) }, (_, i) => ({
            id: id('mrev', i + 1),
            showId: id('show', randInt(1, count)),
            author: fullName(),
            score: randInt(1, 10),
            headline: pick(['Masterpiece', 'Disappointing', 'Surprisingly good', 'Overrated',
                'Hidden gem', 'Must watch', 'Skip it', 'Instant classic', 'Mediocre at best']),
            body: `${pick(['This film', 'The movie', 'This production'])} ${pick(['exceeded', 'met', 'failed to meet'])} my expectations.`,
            date: randDate(2),
            spoilers: rand() > 0.8
        }));

        return { shows, reviews };
    }

    function generateBlog(count) {
        const authors = Array.from({ length: Math.max(10, Math.floor(count / 10)) }, (_, i) => ({
            id: id('auth', i + 1),
            name: fullName(),
            email: `${pick(FIRST_NAMES).toLowerCase()}@example.com`,
            bio: `${pick(['Senior', 'Staff', 'Principal', 'Lead'])} ${pick(['Engineer', 'Developer', 'Architect', 'Consultant'])} with ${randInt(3, 20)} years of experience.`,
            followers: randInt(100, 50000),
            joinedAt: randDate(5)
        }));

        const posts = Array.from({ length: count }, (_, i) => ({
            id: id('post', i + 1),
            title: pick(BLOG_TOPICS) + (i > BLOG_TOPICS.length ? ` — Part ${randInt(2, 5)}` : ''),
            authorId: id('auth', randInt(1, authors.length)),
            author: pick(authors).name,
            tags: pickN(TAGS, randInt(2, 6)),
            content: Array.from({ length: randInt(3, 8) }, () =>
                `${pick(['Understanding', 'Exploring', 'Implementing', 'Mastering', 'Optimizing'])} ${pick(TAGS)} is essential for modern ${pick(['development', 'architecture', 'engineering', 'operations'])}.`
            ).join(' '),
            views: randInt(100, 100000),
            likes: randInt(0, 5000),
            comments: randInt(0, 200),
            published: rand() > 0.1,
            publishedAt: randDate(2),
            readingTime: randInt(3, 20)
        }));

        const comments = Array.from({ length: Math.floor(count * 1.5) }, (_, i) => ({
            id: id('cmt', i + 1),
            postId: id('post', randInt(1, count)),
            author: fullName(),
            body: `${pick(['Great article!', 'Very helpful.', 'Thanks for sharing.', 'Interesting perspective.',
                'I disagree with this.', 'Could you elaborate on', 'This helped me a lot.',
                'Looking forward to part 2.'])}`,
            likes: randInt(0, 100),
            date: randDate(1)
        }));

        return { authors, posts, comments };
    }

    function generateEmployees(count) {
        const departments = DEPARTMENTS.map((name, i) => ({
            id: id('dept', i + 1),
            name,
            headcount: randInt(5, 50),
            budget: randInt(500000, 5000000),
            location: pick(['New York', 'San Francisco', 'Austin', 'Seattle', 'Chicago', 'Remote']),
            manager: fullName()
        }));

        const employees = Array.from({ length: count }, (_, i) => ({
            id: id('emp', i + 1),
            name: fullName(),
            email: `${pick(FIRST_NAMES).toLowerCase()}.${pick(LAST_NAMES).toLowerCase()}@company.com`,
            department: pick(DEPARTMENTS),
            departmentId: id('dept', randInt(1, departments.length)),
            title: pick(JOB_TITLES),
            level: pick(['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'M1', 'M2', 'M3']),
            salary: randInt(60000, 350000),
            yearsExperience: randInt(0, 25),
            skills: pickN(TAGS, randInt(3, 8)),
            startDate: randDate(10),
            remote: rand() > 0.4,
            manager: rand() > 0.1 ? fullName() : null
        }));

        return { departments, employees };
    }

    // ── Register built-in types with PluginRegistry ───────────────────────────
    // Called after PluginRegistry is loaded (script order: plugin-registry.js first)

    function registerBuiltins() {
        if (typeof PluginRegistry === 'undefined') return; // safety guard
        const reg = PluginRegistry.DataGenerator;
        reg.register('ecommerce', (count) => { _seed = Date.now(); return generateEcommerce(count); });
        reg.register('movies',    (count) => { _seed = Date.now(); return generateMovies(count); });
        reg.register('blog',      (count) => { _seed = Date.now(); return generateBlog(count); });
        reg.register('employees', (count) => { _seed = Date.now(); return generateEmployees(count); });
    }

    // ── Public API ────────────────────────────────────────────────────────────

    return {
        generate(type, count) {
            _seed = Date.now(); // fresh seed each time
            switch (type) {
                case 'ecommerce': return generateEcommerce(count);
                case 'movies':    return generateMovies(count);
                case 'blog':      return generateBlog(count);
                case 'employees': return generateEmployees(count);
                default:          return generateEcommerce(count);
            }
        },

        /** Register a custom generator type. fn(count) => object */
        register(type, fn) {
            if (typeof PluginRegistry !== 'undefined') {
                PluginRegistry.DataGenerator.register(type, (count) => { _seed = Date.now(); return fn(count); });
            }
            return this;
        },

        /** Initialize — call after PluginRegistry is available */
        init() { registerBuiltins(); return this; },

        // Suggested search terms per type
        searchTerms(type) {
            const map = {
                ecommerce: ['wire', 'run', 'coffee', 'smart', 'ship', 'pend'],
                movies:    ['dark', 'last', 'echo', 'iron', 'brok', 'crim'],
                blog:      ['cloud', 'java', 'docker', 'micro', 'api', 'test'],
                employees: ['engi', 'sales', 'senior', 'staff', 'remote', 'data']
            };
            return map[type] || map.ecommerce;
        },

        // Suggested paths per type
        suggestedPaths(type) {
            const map = {
                ecommerce: [
                    { path: 'products', description: 'All products' },
                    { path: 'reviews', description: 'All reviews' },
                    { path: 'orders', description: 'All orders' }
                ],
                movies: [
                    { path: 'shows', description: 'All shows/movies' },
                    { path: 'reviews', description: 'All reviews' }
                ],
                blog: [
                    { path: 'posts', description: 'All blog posts' },
                    { path: 'authors', description: 'All authors' },
                    { path: 'comments', description: 'All comments' }
                ],
                employees: [
                    { path: 'employees', description: 'All employees' },
                    { path: 'departments', description: 'All departments' }
                ]
            };
            return map[type] || map.ecommerce;
        },

        // Suggested semantic fields per type
        semanticFields(type) {
            const map = {
                ecommerce: ['name', 'category', 'tags'],
                movies:    ['title', 'cast', 'description', 'genre'],
                blog:      ['title', 'content', 'tags', 'author'],
                employees: ['name', 'title', 'department', 'skills']
            };
            return map[type] || map.ecommerce;
        }
    };
})();

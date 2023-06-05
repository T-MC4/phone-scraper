import express from 'express';
import getURLs from '../utils/metaphor.js';
import cors from 'cors';
import { browseWebPage, findPhoneNumbersAndEmails } from '../utils/scraping.js';
import {
    findCompanyDetails,
    createCredentials,
    JsonDatabase,
} from './places.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

// Convert __filename and __dirname from CommonJS to ES6 module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create instances of JsonDatabase for credentials and history
const credentials = new JsonDatabase(
    path.join(__dirname, './json/credentials.json')
);
const history = new JsonDatabase(path.join(__dirname, './json/history.json'));

// Initialize Express app
const app = express();

// Use CORS middleware to allow all origins
app.use(cors({ origin: '*' }));

// Define endpoint for GET /search (pass user request, get back phone numbers)
app.get('/search', async (req, res) => {
    const query = req.query.query;

    if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    const urls = await getURLs(query);
    console.log(urls);
    const data = [];

    for (let url of urls) {
        const text = await browseWebPage(url);
        const { phoneNumbers, emails } = findPhoneNumbersAndEmails(text);
        console.log(phoneNumbers);

        data.push({
            url: url,
            text: text,
            phoneNumbers: phoneNumbers,
            emails: emails,
        });

        console.log(data);
    }

    return res.json(data);
});

// Define endpoint for GET /phone-number
app.get('/phone-number', async (req, res) => {
    const auth = req.headers.authorization;
    console.log(`Received authorization token: ${auth}`);

    let { company, address } = req.query;

    // Check for authorization header and required query params
    if (!auth) return res.sendStatus(401);
    if (!company || !address) return res.sendStatus(400);

    // Lowercase company and address
    company = company.toLowerCase();
    address = address.toLowerCase();

    // Generate endpoint string
    const endpoint = `${req.method.toUpperCase()} ${req.path}`;
    console.log(`Endpoint: ${endpoint}`);

    // Check if the user profile is authorized to use this endpoint
    const profil = credentials.cache.find(
        (a) => auth == `${a.token_type} ${a.token}`
    );

    // TROUBLESHOOT
    console.log(`User profiles: ${JSON.stringify(credentials.cache)}`);
    if (profil) {
        console.log(`User permissions: ${profil.permissions}`);
    }

    if (!profil || !profil.permissions.includes(endpoint))
        return res.sendStatus(403);

    // Remove old entries from history
    history.cache = history.cache.filter(
        (a) => Date.now() - a.date < 1000 * 60 * 60 * 24 * 30
    );
    history.save();

    // Check if the company exists in the history
    const companyHistory = history.cache.find((a) => a.company == company);
    if (companyHistory) {
        if (!companyHistory.international_phone_number)
            return res.status(400).send('No phone number');
        return res.status(200).json({
            international_phone_number:
                companyHistory.international_phone_number,
        });
    }

    // Remove old requests from user profile
    profil.requests = profil.requests.filter(
        (a) => Date.now() - a.date < 1000 * 60 * 60 * 24 * 30
    );

    // Limit user profile to 2000 requests per month
    const monthly = profil.requests.filter(
        (a) => a.endpoint == endpoint
    ).length;
    if (monthly > 2000) {
        credentials.save();
        return res.sendStatus(429);
    }

    // Add the current request to user profile
    profil.requests.push({ endpoint, date: Date.now() });
    credentials.save();

    // Query Google Places API to find the company
    try {
        // Call the findCompanyDetails function
        const result = await findCompanyDetails(company, address, history);
        return res.status(200).json(result);
    } catch (err) {
        // Handle exceptions by logging the error and sending an error response
        console.error(err);
        return res.status(err.statusCode).send(err.message);
    }
});

// Listen to port 3000
app.listen(3000, () => console.log('Server running on http://localhost:3000'));

// Remove after first run
// createCredentials(["GET /phone-number"], credentials);

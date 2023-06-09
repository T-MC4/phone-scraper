import express from 'express';
import cors from 'cors';
import { performance } from 'perf_hooks';
import { getURLs } from './utils/metaphor.js';
// import { reverseLookupOffEmails } from './utils/reverse-lookup.js';
import {
    browseWebPage,
    findPhoneNumbersAndEmails,
    removeDuplicates,
} from './utils/scraping.js';

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Use CORS middleware to allow all origins
app.use(cors({ origin: '*' }));

// Define endpoint for GET /search (pass user request, get back phone numbers)
app.get('/search', async (req, res) => {
    const start = performance.now();

    const query = req.query.query;
    console.log(query);
    const number = req.query.number;
    console.log(number);

    if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    const arrayOfPromptResults = await getURLs(query, number);

    console.log(arrayOfPromptResults);
    const dataPromises = arrayOfPromptResults
        .filter((result) => result !== undefined)
        .map(async ({ urls, metaphorSearchPrompt }) => {
            return Promise.all(
                urls.map(async (url) => {
                    const text = await browseWebPage(url);
                    const { phoneNumbers, emails } =
                        await findPhoneNumbersAndEmails(text);
                    console.log('Phone Numbers: ', phoneNumbers);

                    const uniqueEmails = removeDuplicates(emails);
                    // const reverseLookupNumbers =
                    //     reverseLookupOffEmails(uniqueEmails);

                    return {
                        metaphorPrompt: metaphorSearchPrompt,
                        url: url,
                        phoneNumbers: removeDuplicates(phoneNumbers),
                        emails: uniqueEmails,
                        // reverseLookupNumbers: reverseLookupNumbers,
                    };
                })
            );
        });

    const data = await Promise.all(dataPromises).then((res) => res.flat());
    console.log(data);

    console.log(`\nSearch took ${performance.now() - start} milliseconds.`);

    return res.json(data);
});

// Listen to port 3000
app.listen(port, () => console.log(`Server running on ${port}`));

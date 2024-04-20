const TelegramBot = require('node-telegram-bot-api');
const whois = require('whois');
const express = require("express");

const app = express();

app.get("/", (req, res) => {
    res.send("Bot is alive");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);
const app_url = process.env.APP_URL;

function lookupWhois(domain, tlds) {
    const results = [];

    function lookupTLD(index) {
        if (index >= tlds.length) {
            return Promise.resolve(results);
        }

        const tld = tlds[index];
        const domainWithTLD = `${domain}.${tld}`;

        // Set the timeout for the WHOIS lookup (5 seconds)
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve({ domain: domainWithTLD, available: "(timeout) Unable to check availability within 5 seconds" });
            }, 5000);
        });

        // WHOIS lookup promise
        const whoisPromise = new Promise((resolve, reject) => {
            whois.lookup(domainWithTLD, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    results.push({ domain: domainWithTLD, available: data.includes('Domain not found') || data.includes('No match for domain') || data.includes(`The queried object does not exist`) || data.includes(`No Data Found`) });
                    resolve();
                }
            });
        });

        // Race between WHOIS lookup and timeout
        return Promise.race([whoisPromise, timeoutPromise])
            .then(() => lookupTLD(index + 1)) // Recursively lookup next TLD
            .catch(() => lookupTLD(index + 1)); // If there's an error, proceed to the next TLD
    }

    return lookupTLD(0);
}

// Endpoint to receive updates from Telegram
app.post(`/webhook/${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Command to check domain with custom TLDs
bot.onText(/\/check (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim().toLowerCase();
    if (!input) {
        bot.sendMessage(chatId, 'Please provide a domain name.');
        return;
    }

    let domain, tlds;
    const dotIndex = input.lastIndexOf('.');
    if (dotIndex !== -1) {
        domain = input.slice(0, dotIndex);
        tlds = [input.slice(dotIndex + 1)];
    } else {
        domain = input;
        tlds = ['com', 'net', 'app']; // Default TLDs
    }

    bot.sendMessage(chatId, `Checking domain availability for "${domain}"`).then((sentMessage) => {
        // Save the message ID for deletion later
        const initialMessageId = sentMessage.message_id;

        lookupWhois(domain, tlds)
            .then((results) => {
                if (results.length === 0) {
                    bot.sendMessage(chatId, 'No results found.');
                    return;
                }

                let message = `Results for checking ${domain} tlds:\n`;
                results.forEach((result) => {
                    message += `${result.domain} ${result.available ? '✅' : '❌'}\n`;
                });

                // Delete the initial message
                if (initialMessageId) {
                    bot.deleteMessage(chatId, initialMessageId);
                }

                // Send the final results
                bot.sendMessage(chatId, message);
            })
            .catch((err) => {
                bot.sendMessage(chatId, 'Error checking domain. Please try again later.');
                console.error('Error:', err);
            });
    });
});

// Set webhook
bot.setWebHook(`${app_url}/webhook/${token}`);

console.log('Bot is running...');
constole.log('updated');

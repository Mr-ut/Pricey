require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const expressLayout = require('express-ejs-layouts');
const connectDB = require('./server/config/db');
const methodOverride = require('method-override');
const cron = require('node-cron');
const Bull = require('bull');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const Product = require('./server/models/Product');

// Express app
const app = express();
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static('public'));
app.use(methodOverride('_method'));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.use(expressLayout);
app.set('layout', './layouts/main');

// Connect to the database
connectDB();

// BullMQ queue
const priceDropQueue = new Bull('priceDropQueue');

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Function to send email
async function sendEmail(product) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: product.userEmail,  // assuming you have user's email stored in the product document
        subject: 'Price Drop Alert!',
        text: `The price of ${product.title} has dropped to ${product.price}. Check it out here: ${product.url}`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// Process BullMQ queue
priceDropQueue.process(async (job) => {
    await sendEmail(job.data);
});

// Web scraper function
async function webscrapper(url){
    const browser = await puppeteer.launch({});
    const page = await browser.newPage();
    await page.goto(url);

    var product = await page.waitForSelector('#productTitle')
    var productText = await page.evaluate(product => product.textContent.trim(), product);

    var price = await page.waitForSelector(".a-price-whole")
    var priceText = await page.evaluate(price => price.textContent.replace(',', '').trim(), price);

    await browser.close();
    return { productText, priceText };
}

// Cron job to check price every hour
cron.schedule('0 * * * *', async () => {
    console.log('Running price check...');

    const products = await Product.find({});
    for (let product of products) {
        try {
            const { priceText } = await webscrapper(product.url);
            const currentPrice = parseFloat(priceText);

            if (currentPrice < parseFloat(product.price.replace(',', ''))) {
                // Update price in the database
                product.price = priceText;
                await product.save();

                // Add job to BullMQ queue
                priceDropQueue.add(product);
            }
        } catch (error) {
            console.error(`Error updating product ${product.title}:`, error);
        }
    }
});

// Routes
app.get("/", async (req, res) => {
    try {
        let perPage = 6;
        let page = req.query.page || 1;
    
        const data = await Product.aggregate([ { $sort: { searchedAt: -1 } } ])
            .skip(perPage * page - perPage)
            .limit(perPage)
            .exec();
    
        const count = await Product.countDocuments();
        const nextPage = parseInt(page) + 1;
        const hasNextPage = nextPage <= Math.ceil(count / perPage);
    
        res.render('index', { 
            data,
            current: page,
            nextPage: hasNextPage ? nextPage : null,
            currentRoute: '/'
        });
    } catch (error) {
        console.log(error);
    }
});

app.post("/", async (req, res) => {
    try {
        var url = String(req.body.url);
        var { productText, priceText } = await webscrapper(url);
        
        const newProduct = new Product({
            title: productText,
            price: priceText,
            url: url
        });
        await Product.create(newProduct);
        res.redirect('/');
    } catch (error) {
        console.log(error);
    }
});

// DELETE Route
app.delete('/delete-post/:id', async (req, res) => {
    try {
        await Product.deleteOne({ _id: req.params.id });
        res.redirect('/');
    } catch (error) {
        console.log(error);
    }
});

// Start server
app.listen(3000, () => {
    console.log("Listening on port 3000");
});

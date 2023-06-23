require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const expressLayout = require('express-ejs-layouts');
const connectDB = require('./server/config/db');
const methodOverride = require('method-override');
var url = require('url');
const Product = require('./server/models/Product');
//express app
const app = express();
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static('public'));
app.use(methodOverride('_method'));


// Set EJS as templating engine
app.set('view engine', 'ejs');
app.use(expressLayout);
app.set('layout', './layouts/main');


connectDB();
//webscrapping
const puppeteer = require('puppeteer');

app.get("/",async(req,res)=>{
    // res.sendFile(__dirname+"/index.html")
    // res.render('index');
    try {
        let perPage = 6;
        let page = req.query.page || 1;
    
        const data = await Product.aggregate([ { $sort: { searchedAt: -1 } } ])
        .skip(perPage * page - perPage)
        .limit(perPage)
        .exec();
    
        const count = await Product.count();
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
})

app.post("/",async(req,res)=>{
     //'https://amzn.eu/d/5ep0PLQ'
    //console.log(result);
    //res.send(result);
    try {
        var url = String(req.body.url);
        //console.log(url);
        var { productText,priceText } = await webscrapper(url);
        //console.log(price)
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

//DELETE
//Admin - Delete Post
app.delete('/delete-post/:id', async (req, res) => {
    try {
        await Product.deleteOne({ _id: req.params.id });
        res.redirect('/');
    } catch (error) {
        console.log(error)
    }
});

//Date function
//function getData() {
    let date = new Date();
    let fullDate = date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
    // return fullDate;
//}

//web scrapper function
async function webscrapper(url){
    const browser = await puppeteer.launch({});
    const page = await browser.newPage();
    await page.goto(url);

    var product = await page.waitForSelector('#productTitle')
    var productText = await page.evaluate(product => product.textContent, product)

    var price = await page.waitForSelector(".a-price-whole")
    var priceText = await page.evaluate(price => price.textContent, price )

    //console.log("Date: " + fullDate + " product: " + productText + " price: " + priceText)
    browser.close();
    // return "Date: " + fullDate +  " Product: " + productText + " Price: " + priceText;
    //priceText=String(priceText)
    return { productText,priceText };
};

// 

app.listen(3000,()=>{
    console.log("listning to port 3000")
    
})
// webscrapper('https://amzn.eu/d/5ep0PLQ')
// chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
//     var tab = tabs[0];
//     console.log(tab.url);
//   });










// function insertPostData(){
    //         Product.insertMany([
    //             {
    //                 title: "Fire watch",
    //                 price: 1200
    //             },
    //             {
    //                 title: "Analog Watch",
    //                 price: 1610
    //             },
    //             {
    //                 title: "Digital Watch",
    //                 price: 3999
    //             },
    //             {
    //                 title: "Apple Watch",
    //                 price: 39999
    //             }
    //         ])
    //     }
    //      insertPostData();
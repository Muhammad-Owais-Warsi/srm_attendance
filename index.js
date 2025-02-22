#!/usr/bin/env node
import puppeteer from "puppeteer"; 
import Tesseract from "tesseract.js"; 
import * as cheerio from "cheerio"; 
import ora from "ora";
import readlineSync from "readline-sync";
import os from "os";
import path from "path";
import fs from "fs"

const NET_ID = readlineSync.question("Enter your Net ID: ");
const PASS = readlineSync.question("Enter your Password: ", { hideEchoBack: true });

const CAPTCHA_IMAGE_PATH = path.join(os.tmpdir(), 'captcha.png');
const SITE_PATH = "https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp"
const MAIN_PAGE = "https://sp.srmist.edu.in/srmiststudentportal/students/template/HRDSystem.jsp"


async function attendance() {
  
    const spinner = ora("🚀 Waking up the browser...").start();
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ["--start-maximized"],
    });
    const page = await browser.newPage();
    spinner.succeed("Browser is awake! ☕");

   
    spinner.start("🌐 Sprinting to the login page...");
    await page.goto(SITE_PATH, {
        waitUntil: "domcontentloaded",
    });



    const captchaElement = await page.$("#login_form img");

    if (!captchaElement) {
        spinner.fail("CAPTCHA not found!");
        await browser.close();
        return;
    }



    await captchaElement.screenshot({ path: CAPTCHA_IMAGE_PATH });


    const { data: { text } } = await Tesseract.recognize(CAPTCHA_IMAGE_PATH, "eng");
    
    const CAPTCHA = text.trim();



    spinner.start("⌨️ Typing credentials like a ninja...");
    await page.type("#login", NET_ID);
    await page.type("#passwd", PASS);
    await page.type("#ccode", CAPTCHA);
    spinner.succeed("Credentials entered!");


    spinner.start("🖱️ Clicking login... Fingers crossed!");
    await page.evaluate(() => {
        const form = document.querySelector("form#login_form");
        if (!form) return;

        const buttons = form.querySelectorAll("button, input[type='submit']");
        if (buttons.length > 0) {
            buttons[buttons.length - 1].click(); 
        }
    });
 

    spinner.start("⏳ Waiting... Will it work?");
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    await new Promise(async(resolve) => {
        const startTime = Date.now();
        const timeout = 5000; // 5 seconds
    
        while (Date.now() - startTime < timeout) { 
            // Check for error message
            const errorText = await page.evaluate(() => {
                const form = document.querySelector("#login_form");
                if (!form) return "Form not found";
            
                const div = form.querySelector('div[class*="alert"]'); 
    
                return div ? div.innerText.trim() : "Div not found";
            });
            

            
    
            if (errorText) {
                console.log("\n")
                console.log("❌", errorText);
                spinner.stop()
                await browser.close();
                return;
            }
    
            // Check if login is successful
            if (page.url() === MAIN_PAGE) {
                resolve(); // Success! Exit loop early
                return;
            }
    
            // Wait 500ms before checking again
            await new Promise(r => setTimeout(r, 500));
        }
    });
    
    
    spinner.succeed("🎉 We’re in!")
    


    spinner.start("📊 Stealing... I mean, extracting attendance data...");
    await page.waitForSelector("#listId9");
    await page.click("#listId9");



    const mainHtml = await new Promise((resolve) => {
        setTimeout(async () => {
            const html = await page.evaluate(() => {
                const layoutContainer = document.querySelector("#layoutSidenav_content");
                if (!layoutContainer) return "Container #layoutSidenav_content not found!";

                const mainElement = layoutContainer.querySelector("main");
                return mainElement ? mainElement.innerHTML : "<main> not found inside #layoutSidenav_content!";
            });
            resolve(html);
        }, 5000); 
    });



    const $ = cheerio.load(mainHtml);


    const table = $(".card-body.p-0 table.table.mb-0");

    if (table.length === 0) {
        console.log("❌ Table not found!");
    } else {

        // Extract table headers
        const headers = [];
        table.find("thead th").each((index, element) => {
            if (index !== 0) { // Skip the first header
                headers.push($(element).text().trim());
            }
        });

        // Extract table rows
        const rows = [];
        table.find("tbody tr").each((index, element) => {
            const row = {};
            const tds = $(element).find("td").slice(1); 

            const isLastRow = index === table.find("tbody tr").length - 1;
        
            tds.each((i, td) => {
                let value = $(td).text().trim();
        
                if (i === 0) {
                    value = value.slice(0, 20) + "..."; 
                }
        
                if (isLastRow) {
              
                    if (i === 0) {
                        row[headers[i]] = "Total"; 
                    } else {
                 
                        row[headers[i + 1]] = value;
                    }
                } else {
                   
                    row[headers[i]] = value;
                }
            });
        
            rows.push(row);
        });
        
        spinner.succeed("🥳 Congrats!")
        console.table(rows);
    }



    await browser.close();
 
}

// Run the main function
attendance().catch((err) => {
    console.error("❌ Error occurred:", err);
});
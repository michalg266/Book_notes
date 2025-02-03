import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const port = 3000;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

let imageBuffer = null;
let imageBase64 = null;
let storedBooks = [];


// initialization of the PostgreSQL database
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "bookNotes",
    password: "dataroko",
    port: 5432,
});

db.connect();

function yearNow() {
    let year = new Date()
    year = year.getFullYear();
    return year;
}

// converting date function
function readableDate(DBinput) {
    DBinput.forEach(book => {
        let book_date = new Date(book.revdate);
        let year = book_date.getFullYear();
        let month = book_date.getMonth() + 1;
        let day = book_date.getDate();
        let hour = book_date.getHours();
        let minutes = book_date.getMinutes().toString().padStart(2, "0");
        let date_to_disp = `${day}.${month}.${year} at ${hour}:${minutes}`;
        book.revdate = date_to_disp;
    });
}



//getting cover based on ISBN
// example isbn 9781443434973, 1541742486
// code below fetches a cover of given book based on isbn and renders a submit page (submit.ejs) 
// where the cover will already be present when inputing other stuff
app.post("/add", async (req, res) => {
    const extractedISBN = req.body.addISBN;
    const linkToFetch = `https://covers.openlibrary.org/b/isbn/${extractedISBN}-M.jpg`;

    try {
        const response = await fetch(linkToFetch);
        if (!response.ok) {
            console.log("Problem with fetching (in try block)")
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        imageBase64 = imageBuffer.toString('base64');

        let year = yearNow();
        res.render("submit.ejs", {
            yearForFooter: year,
        });
        console.log("Fetch successful!");
   
    } catch(error) {
        console.log("There has been a problem with fetching: ", error);
        res.status(500).send("Fetch not succesful");
    }

});


//this code is need to render the cover - it will be rendered when path /cover is called
app.get("/covers", (req, res) => {
    if (imageBuffer) {
        res.set("Content-type", "image/jpeg");
        res.send(imageBuffer);
    } else {
        console.log("No image available");
        res.redirect("/");
    }
});

//here is the code for receiving submited review and storing it as an object
app.post("/newReview", async (req, res) => {
    let addDate = new Date();
    let todb_cover = imageBase64;
    let todb_author = req.body.addAuthor;
    let todb_title = req.body.addTitle;
    let todb_review = req.body.addReview;
    let todb_rating = req.body.addRating;
    let todb_date = addDate.toISOString();

    // sending the data to the database
    await db.query("INSERT INTO books (cover, author, title, review, rating, revdate) VALUES ($1, $2, $3, $4, $5, $6)", [todb_cover, todb_author, todb_title, todb_review, todb_rating, todb_date]);

    res.redirect("/");
});


// getting all stored books from database and storing sending them to frontend
app.get("/", async (req, res) => {
    let year = yearNow();
    try {
        let booksSQL = await db.query("SELECT * FROM books");
        booksSQL =  booksSQL.rows;
        // putting date to human readable format
        readableDate(booksSQL);
        res.render("home.ejs", {
            books: booksSQL,
            yearForFooter: year,
        });
    } catch(error) {
        console.log("Etwas ist schief gelaufen", error);
    }
});

app.get("/review/:reviewID", async (req, res) => {
    let idOfReview = req.params.reviewID;
    let specificReview = await db.query("SELECT * FROM books WHERE id = ($1)", [idOfReview]);
    specificReview = specificReview.rows;
    readableDate(specificReview);
    let year = yearNow();
    res.render("review.ejs", {
        review: specificReview,
        yearForFooter: year,
    });
});

app.patch("/updateReview", async (req, res) => {
    let updatedReview = req.body.updatedReview;
    let idToChange = req.body.reviewIdecko;
    await db.query("UPDATE books SET review = ($1) WHERE id = ($2)", [updatedReview, idToChange]);
    res.status(200).send("Ok");
});

// not best practise to delete with post, but im using form on 
// frontend which only supports get and post
app.post("/delete/:idToDelete", async (req, res) => {
    let deleteID = req.params.idToDelete;
    console.log(`Vymazat treba id:  ${deleteID}`);
    await db.query("DELETE FROM books WHERE id = ($1)", [deleteID]);
    res.redirect("/");
});

app.post("/sort", async(req, res) => {
    let sortingCriterium = req.body.sorting;
    console.log(`Retreived value: ${sortingCriterium}`);

    // whitelist protection if attacker would manipulate button value eg in postman
    let allowedColumns = ["rating", "revdate"];
    if (!allowedColumns.includes(sortingCriterium)) {
        return res.status(400).send("Error");
    }
    let year = yearNow();


    try {
        let sortedReviews = await db.query(`SELECT * FROM books ORDER BY ${sortingCriterium} DESC`);
        sortedReviews = sortedReviews.rows;
        readableDate(sortedReviews);
        console.log(`These are sorter reviews by ${sortingCriterium}: ${sortedReviews}`);
        res.render("home.ejs", {
            books: sortedReviews,
            yearForFooter: year,
        });
  

    } catch(error) {
        res.status(500).send("Internal server error");
    }

});



app.listen(port, () => {
    console.log("Sever running on port 3000")
});
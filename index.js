import express from "express";
const app = express();
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

const port = process.env.PORT || 5000;

dotenv.config();


app.use(cors());
app.use(express.json());

// MongoDB Connection

const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const db = client.db("NexCart");
const productCollection = db.collection("products");

// GET Example
app.get("/", (req, res) => {
    res.send("Backend is running...");
});



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // get products
        app.get('/products', async (req, res) => {
            const result = await productCollection.find().toArray();
            res.send(result)
        })

        // get trending products
         app.get('/top-products', async (req, res) => {
            const result = await productCollection.find().limit(6).toArray();
            res.send(result)
        })

          app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const result = await productCollection.findOne({_id: new ObjectId(id)})
            res.send(result)
        })

        // POST products
        app.post("/products", async (req, res) => {
            const result = await productCollection.insertOne(req.body);
            res.send(result);
        });




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



// Server running
app.listen(port, () => console.log(`Server running on port :${port}`));




/**
 * const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------
// Fake Database (You can replace with MongoDB later)
// ------------------------
let users = [];
let products = [];

// ------------------------
// JWT Middleware
// ------------------------
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.user = decoded;
    next();
  });
}

// ------------------------
// Auth Routes
// ------------------------

// REGISTER
app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;

  const existing = users.find((u) => u.email === email);
  if (existing) return res.send({ error: "User already exists" });

  const newUser = { id: Date.now(), name, email, password };
  users.push(newUser);

  res.send({ message: "User registered", user: newUser });
});

// LOGIN
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(400).send({ error: "Invalid credentials" });

  const token = jwt.sign({ email: user.email, id: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.send({ message: "Login successful", token, user });
});

// ------------------------
// Product Routes
// ------------------------

// GET ALL PRODUCTS
app.get("/api/products", (req, res) => {
  res.send(products);
});

// GET SINGLE PRODUCT
app.get("/api/products/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const product = products.find((p) => p.id === id);

  if (!product) return res.status(404).send({ message: "Product not found" });

  res.send(product);
});

// ADD PRODUCT (protected)
app.post("/api/products", verifyJWT, (req, res) => {
  const { title, shortDesc, fullDesc, price, image } = req.body;

  const newProduct = {
    id: Date.now(),
    title,
    shortDesc,
    fullDesc,
    price,
    image,
    createdBy: req.user.email,
  };

  products.push(newProduct);

  res.send({ message: "Product added", product: newProduct });
});

// DELETE PRODUCT (protected)
app.delete("/api/products/:id", verifyJWT, (req, res) => {
  const id = parseInt(req.params.id);
  products = products.filter((p) => p.id !== id);
  res.send({ message: "Product deleted" });
});

// ------------------------
// Root Route
// ------------------------
app.get("/", (req, res) => {
  res.send("🚀 NexCart Server Running");
});

// ------------------------
// Start Server
// ------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

 */

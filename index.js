import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
import { auth } from 'express-oauth2-jwt-bearer'; // <-- NEW: Import JWT checker

const app = express();
const port = process.env.PORT || 5000;

dotenv.config();

app.use(cors());
app.use(express.json());




const CLERK_AUDIENCE = 'YOUR_AUDIENCE_FROM_CLERK';


const CLERK_ISSUER = 'https://clerk.your-domain.com';


const checkJwt = auth({
  audience: CLERK_AUDIENCE,
  issuerBaseURL: CLERK_ISSUER,
});



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
const cartCollection = db.collection('cart')

// GET Example
app.get("/", (req, res) => {
  res.send("Backend is running...");
});


async function run() {
  try {
    await client.connect();

    // get products (Public Route - No Auth Required)
    app.get('/products', async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result)
    })

    // get trending products (Public Route - No Auth Required)
    app.get('/top-products', async (req, res) => {
      const result = await productCollection.find().limit(6).toArray();
      res.send(result)
    })

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.findOne({ _id: new ObjectId(id) })
      res.send(result)
    })

    // POST products (Protected Route - Uses checkJwt middleware)
    // If the JWT token is invalid, this route will automatically return a 401 Unauthorized error.
    app.post("/products", async (req, res) => {



      try {
        // Ensure data fields match the frontend submission
        const productData = {
          ...req.body,
          // Optionally: Add the user ID who created the product
          // creatorId: clerkUserId, 
          createdAt: new Date()
        };

        const result = await productCollection.insertOne(productData);
        res.status(201).send({
          message: "Product added successfully",
          insertedId: result.insertedId
        });
      } catch (error) {
        console.error("MongoDB Insert Error:", error);
        res.status(500).send({ message: "Failed to save product to database." });
      }
    });



    // update api


    app.put("/products/:id", async (req, res) => {
      try {
        const result = await productCollection.findOneAndUpdate(
          { _id: new ObjectId(req.params.id) },
          { $set: req.body },
          { returnDocument: "after" }
        );

        if (!result) return res.status(404).send({ message: "Product not found" });

        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });




    // Delete api


    app.delete("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log("Deleting product:", id);

        const result = await db.collection("products").deleteOne({
          _id: new ObjectId(id)
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        res.json({ message: "Product deleted successfully" });

      } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ message: error.message });
      }
    });



    // Cart related api

    // products by secondary id
    // POST /products/by-ids
    app.post("/products/by-ids", async (req, res) => {
      try {
        const { productIds } = req.body;

        const products = await productCollection
          .find({ _id: { $in: productIds.map(id => new ObjectId(id)) } })
          .toArray();

        res.send(products);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // add on cart

    app.post("/cart", async (req, res) => {
      try {
        const { userId, productId, quantity } = req.body;

        // Check if already in cart
        const existing = await cartCollection.findOne({
          userId,
          productId
        });

        if (existing) {
          // Increase quantity
          const result = await cartCollection.updateOne(
            { _id: existing._id },
            { $inc: { quantity } }
          );
          return res.send({ message: "Quantity updated" });
        }

        // Add new item
        const result = await cartCollection.insertOne({
          userId,
          productId,
          quantity,
          createdAt: new Date()
        });

        res.send({ message: "Added to cart", result });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // get cart api
    app.get("/cart/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const items = await cartCollection
          .find({ userId })
          .toArray();

        res.send(items);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });


    // update cart item
    app.put("/cart/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { quantity } = req.body;

        const result = await cartCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { quantity } }
        );

        res.send({ message: "Cart updated", result });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });


    // delete cart item 
    app.delete("/cart/:id", async (req, res) => {
      try {
        const result = await cartCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.send({ message: "Item removed", result });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
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





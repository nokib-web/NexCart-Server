import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const SSLCommerzPayment = require('sslcommerz-lts');


const app = express();
const port = process.env.PORT || 5000;

dotenv.config();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";

// middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://nexcart-mu.vercel.app",
    "https://nexcart-client.vercel.app" // Just in case
  ],
  credentials: true
}));
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

await client.db("admin").command({ ping: 1 });
console.log("Pinged your deployment. You successfully connected to MongoDB!");



const db = client.db("NexCart");
const productCollection = db.collection("products");
const cartCollection = db.collection('cart')
const userCollection = db.collection('users');
const orderCollection = db.collection('orders');
const reviewCollection = db.collection('reviews');

// verify admin middleware
// verify admin middleware
const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.body?.email || req.query?.email || req.params?.email;
    if (!email) {
      return res.status(401).send({ message: 'unauthorized access: no email provided' });
    }
    const user = await userCollection.findOne({ email: email });
    if (user?.role !== 'admin') {
      return res.status(403).send({ message: 'forbidden access' })
    }
    next();
  } catch (error) {
    console.error("verifyAdmin Middleware Error:", error);
    res.status(500).send({ message: `verifyAdmin Error: ${error.message}` });
  }
}

// verify seller middleware
const verifySeller = async (req, res, next) => {
  try {
    const email = req.body?.email || req.query?.email || req.params?.email;
    if (!email) {
      return res.status(401).send({ message: 'unauthorized access: no email provided' });
    }
    const user = await userCollection.findOne({ email: email });
    if (user?.role !== 'seller' && user?.role !== 'admin') {
      return res.status(403).send({ message: 'forbidden access' })
    }
    next();
  } catch (error) {
    console.error("verifySeller Middleware Error:", error);
    res.status(500).send({ message: `verifySeller Error: ${error.message}` });
  }
}

// GET Example
app.get("/", (req, res) => {
  res.json("Backend is running...");
});


async function run() {
  try {
    await client.connect();

    // User related apis
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne({
        ...user,
        role: 'customer',
        timestamp: Date.now(),
      });
      res.send(result);
    })

    app.get('/users', verifyAdmin, async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("GET /users Error:", error);
        res.status(500).send({ message: "Internal Server Error fetching users", error: error.message });
      }
    })

    app.patch('/users/role/:id', verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: role
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // Delete User
    app.delete("/users/:id", verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    })

    // get products (Public Route - No Auth Required)
    app.get('/products', async (req, res) => {
      try {
        const { search, category, brand, minPrice, maxPrice, sort } = req.query;
        const query = {};

        if (search) {
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } }
          ];
        }

        if (category && category !== 'All') {
          query.category = category;
        }

        if (brand) {
          query.brand = brand;
        }

        if (minPrice || maxPrice) {
          query.price = {};
          if (minPrice) query.price.$gte = parseFloat(minPrice);
          if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        let sortOptions = {};
        if (sort === 'price-asc') sortOptions.price = 1;
        else if (sort === 'price-desc') sortOptions.price = -1;
        else if (sort === 'newest') sortOptions.createdAt = -1;

        // Pagination Logic
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12; // Default 12 products
        const skip = (page - 1) * limit;

        const totalProducts = await productCollection.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await productCollection
          .find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .toArray();

        res.json({
          products,
          totalProducts,
          totalPages,
          currentPage: page
        });
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Failed to fetch products" });
      }
    })

    // get trending products (Public Route - No Auth Required)
    app.get('/top-products', async (req, res) => {
      const result = await productCollection.find().limit(6).toArray();
      res.json(result)
    })

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.findOne({ _id: new ObjectId(id) })
      res.json(result)
    })

    // POST products (Protected Route - Uses checkJwt middleware)

    // POST products (Protected Route - Uses checkJwt middleware)

    app.post("/products", verifySeller, async (req, res) => {



      try {
        // Ensure data fields match the frontend submission
        const productData = {
          ...req.body,

          createdAt: new Date()
        };

        const result = await productCollection.insertOne(productData);
        res.status(201).json({
          message: "Product added successfully",
          insertedId: result.insertedId
        });
      } catch (error) {
        console.error("MongoDB Insert Error:", error);
        res.status(500).json({ message: "Failed to save product to database." });
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

        if (!result) return res.status(404).json({ message: "Product not found" });

        res.json(result);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });




    // Delete api


    app.delete("/products/:id", verifySeller, async (req, res) => {
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

    // Reviews APIs
    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;
        const result = await reviewCollection.insertOne({
          ...review,
          createdAt: new Date()
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    app.get("/reviews/:productId", async (req, res) => {
      try {
        const productId = req.params.productId;
        const result = await reviewCollection.find({ productId }).sort({ createdAt: -1 }).toArray();
        res.json(result);
      } catch (error) {
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

        res.json(products);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // add on cart

    app.post("/cart", async (req, res) => {
      try {
        const { userId, productId, quantity, size, color } = req.body;

        // Check if already in cart (same product AND same variant)
        const checkQuery = {
          userId,
          productId,
          size: size || null,
          color: color || null
        };

        const existing = await cartCollection.findOne(checkQuery);

        if (existing) {
          // Increase quantity
          const result = await cartCollection.updateOne(
            { _id: existing._id },
            { $inc: { quantity } }
          );
          return res.json({ message: "Quantity updated" });
        }

        // Add new item
        const result = await cartCollection.insertOne({
          userId,
          productId,
          quantity,
          size: size || null,
          color: color || null,
          createdAt: new Date()
        });


        res.json({ message: "Added to cart", result });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // get cart api
    app.get("/cart/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const items = await cartCollection
          .find({ userId })
          .toArray();

        res.json(items);
      } catch (err) {
        res.status(500).json({ message: err.message });
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

        res.json({ message: "Cart updated", result });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });


    // delete cart item 
    app.delete("/cart/:id", async (req, res) => {
      try {
        const result = await cartCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.json({ message: "Item removed", result });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });


    // Order APIs
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne({
        ...order,
        createdAt: new Date(),
        status: order.status || 'pending',
        paymentMethod: order.paymentMethod || 'online'
      });

      // Clear cart for this user
      // Cart items are stored with `userId`
      if (order.userId) {
        await cartCollection.deleteMany({ userId: order.userId });
      } else if (order.customerEmail) {
        // Fallback if userId not provided (though it should be)
        // But cart is strictly userId based in POST /cart. 
        // Let's assume userId is key.
        // checking if any cart items rely on email? No, POST /cart uses userId.
      }

      res.json({ message: "Order placed", result });
    });

    app.patch("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body; // e.g., 'shipped', 'cancelled'
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: status }
        };
        const result = await orderCollection.updateOne(filter, updateDoc);
        res.json(result);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.get("/orders", async (req, res) => {
      const { email, role } = req.query;

      let query = {};
      if (role === 'customer') {
        query = { customerEmail: email }
      } else if (role === 'seller') {
        query = { "items.sellerEmail": email }
      }

      const result = await orderCollection.find(query).toArray();
      res.json(result);
    });

    app.get("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await orderCollection.findOne({ _id: new ObjectId(id) });
        if (!result) return res.status(404).json({ message: "Order not found" });
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });


    // Payment API

    // Note: SSLCommerz might not have default export for ESM. 
    // If 'import SSLCommerzPayment from "sslcommerz-lts"' fails, we might need dynamic import or createRequire.
    // Let's try dynamic import or createRequire which is standard for mixed modules.

    const store_id = process.env.STORE_ID || 'testbox'
    const store_passwd = process.env.STORE_PASS || 'qwerty'
    const is_live = false //true for live, false for sandbox

    app.post("/create-payment", async (req, res) => {
      const order = req.body;
      const transId = new ObjectId().toString();

      const data = {
        total_amount: order.totalPrice,
        currency: 'USD',
        currency: 'USD',
        tran_id: transId, // Use unique tran_id for each api call
        success_url: `${SERVER_URL}/payment/success/${transId}`,
        fail_url: `${SERVER_URL}/payment/fail/${transId}`,
        cancel_url: `${SERVER_URL}/payment/cancel/${transId}`,
        ipn_url: `${SERVER_URL}/ipn`,
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: order.customerName,
        cus_email: order.customerEmail,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
      };

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL

        // Save preliminary order info
        const finalOrder = {
          ...order,
          transactionId: transId,
          status: 'pending', // Pending payment
          paidStatus: false,
          createdAt: new Date()
        }

        orderCollection.insertOne(finalOrder);

        // Also delete from cart now, or wait for success? 
        // Better to wait for success usually, but for simplicity we can emulate "checkout" = "removed from cart"
        // If payment fails, user has to re-add? That's bad UX.
        // Let's NOT delete from cart here. Delete on success.

        res.send({ url: GatewayPageURL });
      });
    })

    app.post("/payment/success/:tranId", async (req, res) => {
      const { tranId } = req.params;
      const result = await orderCollection.updateOne(
        { transactionId: tranId },
        {
          $set: {
            status: 'paid',
            paidStatus: true
          }
        }
      );

      // Now clear the cart. We need the userId or email from the order.
      const order = await orderCollection.findOne({ transactionId: tranId });
      if (order && order.customerEmail) {
        await cartCollection.deleteMany({ email: order.customerEmail });
      } else if (order && order.userId) {
        await cartCollection.deleteMany({ userId: order.userId });
      }

      res.redirect(`${CLIENT_URL}/payment/success/${tranId}`)
    })

    app.post("/payment/fail/:tranId", async (req, res) => {
      const { tranId } = req.params;
      const result = await orderCollection.deleteOne({ transactionId: tranId });
      res.redirect(`${CLIENT_URL}/payment/fail/${tranId}`)
    })

    app.listen(port, () => console.log(`Server running on port :${port}`));






  } finally {

  }
}
run()






const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c5ebkxr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {
    await client.connect();

    const mealsCollection = client.db("campusHub").collection("meals");
    const reviewsCollection = client.db("campusHub").collection("reviews");
    const paymentCollection = client.db("campusHub").collection("payments");
    const userCollection = client.db("campusHub").collection("users");
    const mealRequestsCollection = client.db("campusHub").collection("mealRequests");

    // JWT Token Generation
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // JWT Middleware for protected routes
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

// Use verify admin after verifyToken
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};

    // Get all meals
    app.get('/meals', async (req, res) => {
      try {
        const result = await mealsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error retrieving meals' });
      }
    });


    // Add a meal
    app.post('/meals', verifyToken, verifyAdmin, async (req, res) => {
      const meal = req.body;
      try {
        const result = await mealsCollection.insertOne(meal);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error adding meal' });
      }
    });

// Get meal details by ID
app.get("/meals/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const meal = await mealsCollection.findOne({ _id: new ObjectId(id) });
    if (!meal) {
      return res.status(404).json({ error: "Meal not found" });
    }
    res.json(meal);
  } catch (error) {
    console.error("Error fetching meal data:", error);
    res.status(500).send({ message: "Error fetching meal data" });
  }
});
    // Get meal count
    app.get('/meals/count', async (req, res) => {
      try {
        const { adminEmail } = req.query;
        if (!adminEmail) {
          return res.status(400).send({ message: 'Admin email is required' });
        }
        const mealCount = await mealsCollection.countDocuments({ adminEmail });
        res.status(200).json({ count: mealCount });
      } catch (error) {
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Like/Dislike a meal
app.post('/meals/:id/like', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { userId, isLiked } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid meal ID' });
  }

  try {
    const meal = await mealsCollection.findOne({ _id: new ObjectId(id) });
    if (!meal) {
      return res.status(404).send({ message: 'Meal not found' });
    }

    const update = isLiked ? { $inc: { likes: -1 } } : { $inc: { likes: 1 } };
    const result = await mealsCollection.updateOne({ _id: new ObjectId(id) }, update);

    if (result.modifiedCount === 1) {
      res.send({ message: 'Like status updated' });
    } else {
      res.status(500).send({ message: 'Failed to update like status' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Server error', error });
  }
});

    // Get all reviews
    app.get('/reviews', async (req, res) => {
      try {
        const result = await reviewsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error retrieving reviews' });
      }
    });
    // Add a review to a meal
app.post('/reviews', verifyToken, async (req, res) => {
  const review = req.body;
  try {
    const result = await reviewsCollection.insertOne(review);
    res.send(result.ops[0]);
  } catch (error) {
    res.status(500).send({ message: 'Error adding review' });
  }
});


    // Add a review to a meal
app.post('/meals/:id/reviews', verifyToken, async (req, res) => {
  const id = req.params.id;
  const review = req.body;
  review.mealId = new ObjectId(id);
  review.userId = new ObjectId(req.decoded._id);
  review.createdAt = new Date();

  try {
    const result = await reviewsCollection.insertOne(review);
    res.send(result.ops[0]);
  } catch (error) {
    res.status(500).send({ message: 'Error adding review' });
  }
});

// Get reviews for a meal
app.get('/meals/:id/reviews', async (req, res) => {
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid meal ID' });
  }

  try {
    const reviews = await reviewsCollection.find({ mealId: new ObjectId(id) }).toArray();
    res.send(reviews);
  } catch (error) {
    res.status(500).send({ message: 'Error retrieving reviews' });
  }
});

    // Delete a review
    app.delete('/reviews/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
    
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid review ID' });
      }
    
      try {
        const query = { _id: new ObjectId(id) };
        const result = await reviewsCollection.deleteOne(query);
    
        if (result.deletedCount === 1) {
          res.send({ message: 'Review deleted successfully' });
        } else {
          res.status(404).send({ message: 'Review not found' });
        }
      } catch (error) {
        res.status(500).send({ message: 'Error deleting review', error });
      }
    });

    // Get all users
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const { search } = req.query;
      let query = {};

      if (search) {
        query = {
          $or: [
            { name: new RegExp(search, 'i') },
            { email: new RegExp(search, 'i') }
          ]
        };
      }

      try {
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error retrieving users' });
      }
    });


    // Check if user is an admin
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const admin = user?.role === 'admin' || false;
      res.send({ admin });
    });

    // Add a user
    app.post('/users', async (req, res) => {
      const user = req.body;
      try {
        const existingUser = await userCollection.findOne({ email: user.email });
        if (existingUser) {
          return res.send({ message: 'User already exists', insertedId: null });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error adding user' });
      }
    });

    // Make user an admin
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = { $set: { role: 'admin' } };
      try {
        const result = await userCollection.updateOne(filter, update);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error updating user role' });
      }
    });

    // Delete a user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await userCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error deleting user' });
      }
    });

    app.get('/serveMeals', async (req, res) => {
      const { search } = req.query;
      let query = {};

      if (search) {
        query = {
          $or: [
            { 'meal.title': { $regex: search, $options: 'i' } },
            { 'user.email': { $regex: search, $options: 'i' } },
            { 'user.name': { $regex: search, $options: 'i' } },
            { status: { $regex: search, $options: 'i' } }
          ]
        };
      }

      try {
        const result = await mealRequestsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error serving meals' });
      }
    });

    // Change meal status to delivered
    app.patch('/serveMeals/:id/delivered', async (req, res) => {
      const id = req.params.id;
      try {
        const result = await mealRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'delivered' } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error updating meal status' });
      }
    });

    // Confirm successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('B9A');
});

app.listen(port, () => {
  console.log(`B9A12 is sitting on port ${port}`);
});

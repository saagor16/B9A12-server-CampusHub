const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
// Middleware
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c5ebkxr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // await client.connect();
    const mealsCollection = client.db("campusHub").collection("meals");
    const upMealsCollection = client.db("campusHub").collection("upMeals");
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
  // Use verifyAdmin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email });
      if (user?.role !== 'admin') {
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
        console.error("Error retrieving meals:", error);
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
        console.error("Error adding meal:", error);
        res.status(500).send({ message: 'Error adding meal' });
      }
    });
    // Get a specific meal
    app.get('/meals/:id', async (req, res) => {
      const id = req.params.id;
      try {
        const meal = await mealsCollection.findOne({ _id: new ObjectId(id)});
        res.send(meal);
      } catch (error) {
        console.error(`Error retrieving meal with id: ${id}`, error);
        res.status(500).send({ message: 'Error retrieving meal' });
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
        console.error("Error retrieving meal count:", error);
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
        console.error("Error updating like status:", error);
        res.status(500).send({ message: 'Server error', error });
      }
    });
    app.patch('/upcomingMeals/:id/publish', async (req, res) => {
      const id = req.params.id;

      try {
        const meal = await upMealsCollection.findOne({ _id: new ObjectId(id) });
        if (!meal) {
          return res.status(404).send({ message: 'Upcoming meal not found' });
        }

        const result = await mealsCollection.insertOne(meal);
        if (result.insertedId) {
          await upMealsCollection.deleteOne({ _id: new ObjectId(id) });
          res.send({ message: 'Meal published successfully' });
        } else {
          res.status(500).send({ message: 'Error publishing meal' });
        }
      } catch (error) {
        console.error('Error publishing meal:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });
// Get all uploaded meals
app.get('/upMeals', async (req, res) => {
  try {
    const meals = await upMealsCollection.find({}).toArray();
    res.json(meals);
  } catch (err) {
    console.error("Error fetching meals:", err);
    res.status(500).json({ message: "Error fetching meals" });
  }
});
// Add an uploaded meal
app.post('/upMeals', async (req, res) => {
  const newMeal = req.body;
  try {
    const result = await upMealsCollection.insertOne(newMeal);
    res.status(201).json(result.ops[0]);
  } catch (err) {
    console.error("Error inserting meal:", err);
    res.status(500).json({ message: "Error inserting meal" });
  }
});
app.get('/requestedMeals/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const requestedMeals = await mealsCollection.find({ userEmail: email }).toArray();
    res.send(requestedMeals);
  } catch (error) {
    console.error("Error retrieving requested meals:", error);
    res.status(500).send({ message: 'Error retrieving requested meals' });
  }
});
// Delete requested meal
app.delete('/requestedMeals/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await mealsCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    console.error("Error deleting requested meal:", error);
    res.status(500).send({ message: 'Error deleting requested meal' });
  }
});
    // Get all reviews
    app.get('/reviews', async (req, res) => {
      try {
        const result = await reviewsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error retrieving reviews:", error);
        res.status(500).send({ message: 'Error retrieving reviews' });
      }
    });
    // Add a review
    app.post('/reviews', verifyToken, async (req, res) => {
      const review = req.body;
      review.userEmail = req.decoded.email;
      review.createdAt = new Date();

      try {
        const result = await reviewsCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).send({ message: 'Error adding review' });
      }
    });
    // Get reviews by email
    app.get('/reviews/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      try {
        const reviews = await reviewsCollection.find({ userEmail: email }).toArray();
        res.send(reviews);
      } catch (error) {
        console.error("Error retrieving reviews:", error);
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
        const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
          res.send({ message: 'Review deleted successfully' });
        } else {
          res.status(404).send({ message: 'Review not found' });
        }
      } catch (error) {
        console.error("Error deleting review:", error);
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
        console.error("Error retrieving users:", error);
        res.status(500).send({ message: 'Error retrieving users' });
      }
    });
    // Check if user is an admin
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      try {
        const user = await userCollection.findOne({ email });
        const admin = user?.role === 'admin' || false;
        res.send({ admin });
      } catch (error) {
        console.error("Error checking admin status:", error);
        res.status(500).send({ message: 'Error checking admin status' });
      }
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
        console.error("Error adding user:", error);
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
        console.error("Error updating user role:", error);
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
        console.error("Error deleting user:", error);
        res.status(500).send({ message: 'Error deleting user' });
      }
    });
    // Get all meal requests
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
        console.error("Error retrieving meal requests:", error);
        res.status(500).send({ message: 'Error retrieving meal requests' });
      }
    });
    app.get('/payments', async (req, res) => {
      try {
        const payments = await paymentCollection.find({}).toArray();
        res.send(payments);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching payments' });
      }
    });

    // Update meal request status to "delivered"
    app.patch('/serveMeals/:id/delivered', verifyToken, async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid meal request ID' });
      }

      try {
        const filter = { _id: new ObjectId(id) };
        const update = { $set: { status: 'delivered' } };

        const result = await mealRequestsCollection.updateOne(filter, update);

        if (result.modifiedCount === 1) {
          const updatedRequest = await mealRequestsCollection.findOne(filter);
          res.send(updatedRequest);
        } else {
          res.status(404).send({ message: 'Meal request not found or already delivered' });
        }
      } catch (error) {
        console.error('Error updating meal request status:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });
    // Payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
        res.send({
          clientSecret: paymentIntent.client_secret
        });
      } catch (error) {
        res.status(500).send({ message: 'Error creating payment intent' });
      }
    });
  // Get payments by email
    app.get('/payments/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      try {
        const result = await paymentCollection.find({ email }).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error retrieving payments' });
      }
    });
    // Record a payment
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      try {
        const result = await paymentCollection.insertOne(payment);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error recording payment' });
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

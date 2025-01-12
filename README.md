# CampusHub Server

The server-side implementation of CampusHub powers the backend functionalities, including secure user authentication, meal management, and seamless integration with the frontend. Built with robust technologies, the server ensures efficient data handling and API communication.

## Live Links
- **Server Repository:** [CampusHub Server](https://github.com/saagor16/B9A12-server-CampusHub)
- **Frontend Repository:** [CampusHub Frontend](https://github.com/saagor16/B9A12-Cline-CampusHub)
- **Live Site:** [CampusHub Live Site](https://b9a12-campushub.web.app/)

## Features

1. **User Authentication**
   - Secure user authentication using JWT for session management.

2. **Meal Management API**
   - Provides CRUD operations for meal management, enabling admins to add, update, delete, and retrieve meal data.

3. **Review and Rating Management**
   - Handles reviews and ratings submitted by users, storing them in the database.

4. **Payment Integration**
   - Processes payments securely through Stripe API integration.

5. **Real-Time Notifications**
   - Implements notification triggers for CRUD operations.

6. **Robust Error Handling**
   - Includes middleware for centralized error handling and enhanced API responses.

7. **Cross-Origin Resource Sharing (CORS)**
   - Configured to allow secure communication between the frontend and backend.

## Tech Stack

- **Node.js**: A runtime environment for executing server-side JavaScript code.
- **Express.js**: A fast and lightweight framework for building RESTful APIs.
- **MongoDB**: A NoSQL database for scalable and efficient data storage.
- **JWT (JSON Web Tokens)**: Ensures secure authentication and session management.
- **Stripe API**: Integrates payment functionalities for secure transactions.

## How to Run the Server Locally

1. **Clone the Repository**
   ```bash
   git clone https://github.com/saagor16/B9A12-server-CampusHub.git
   cd B9A12-server-CampusHub
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**
   - Create a `.env` file in the root directory and include the following:
     ```env
     PORT=5000
     MONGO_URI=your_mongodb_connection_string
     JWT_SECRET=your_jwt_secret
     STRIPE_SECRET_KEY=your_stripe_secret_key
     ```

4. **Run the Server**
   ```bash
   npm start
   ```
   The server will be running at `http://localhost:5000`.



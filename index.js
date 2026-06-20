const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!')
})

// Middleware
const logger = async (req, res, next) => {
    console.log("Middleware Logged ✅");
    next();
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI;

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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db("Hire-Loop-DB");
        const jobCollection = database.collection("jobs");
        const companyCollection = database.collection("companies");
        const userCollection = database.collection("user");
        const applicationsCollection = database.collection("applications");
        const plansCollection = database.collection("plans");
        const subscriptionCollection = database.collection("subscriptions");
        const sessionCollection = database.collection("session");

        // Verification related
        const verifyToken = async (req, res, next) => {

            const authHeader = req.headers?.authorization; // Token with Bearer
            if (!authHeader) {
                return res.status(401).send({ success: false, message: 'Unauthorized access!' })
            }

            const token = authHeader.split(" ")[1];  // Select only token
            if (!token) {
                return res.status(401).send({ success: false, message: 'Unauthorized access!' })
            }

            // Match token to the session
            const query = { token: token };
            const session = await sessionCollection.findOne(query)
            const userId = session.userId;  // userId of userColl

            // Verify user from session userId, in user collection
            const userQuery = { _id: userId };
            const user = await userCollection.findOne(userQuery);
            req.user = user; // Saved user data

            console.log("Session : ", req.user);
            next()
        }

        const verifySeeker = async (req, res, next) => {
            if (req.user?.role !== "seeker") {
                return res.status(403).send({ success: false, message: 'Forbidden access!' })
            };

            next();
        }


        app.get('/api/users', async (req, res) => {
            const result = await userCollection.find().skip(5).toArray();
            res.send(result)
        })

        // Job related api
        app.get('/api/jobs', async (req, res) => {
            const query = {};
            if (req.query.companyId) {
                query.companyId = req.query.companyId;
            }
            if (req.query.status) {
                query.status = req.query.status;
            }

            const result = await jobCollection.find(query).toArray();
            res.json(result);
        })

        app.get('/api/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            }
            const result = await jobCollection.findOne(query);
            res.json(result)
        })

        app.post('/api/jobs', async (req, res) => {
            const job = req.body;
            const newJob = {
                ...job,
                createdAt: new Date()
            }
            const result = await jobCollection.insertOne(newJob);
            res.send(result);
        })

        // Application related api
        app.get('/api/application', verifyToken, verifySeeker, async (req, res) => {
            const query = {};
            if (req.query.applicantId) {
                query.applicantId = req.query.applicantId;

                // Check weather asking for user information that is valid user or someone else
                console.log((req.user?._id).toString(), req.query.applicantId);
            }
            if (req.query.jobId) {
                query.jobId = req.query.jobId;
            }

            const result = await applicationsCollection.find(query).toArray();
            res.json(result)
        })

        app.post('/api/application', async (req, res) => {
            const applicationData = req.body;
            const newApplicationData = {
                ...applicationData,
                createdAt: new Date()
            }

            const result = await applicationsCollection.insertOne(newApplicationData);
            res.json(result)
        })

        // Company related api
        app.get('/api/companies', verifyToken, async (req, res) => {
            const result = await companyCollection.find().toArray();
            res.send(result)
        })

        app.get('/api/my/companies', async (req, res) => {
            const query = {};
            if (req.query.recruiterId) {
                query.recruiterId = req.query.recruiterId;
            }
            const result = await companyCollection.findOne(query);
            res.send(result || {});
        })

        app.post('/api/companies', async (req, res) => {
            const company = req.body;
            const newCompany = {
                ...company,
                createdAt: new Date()
            }
            const result = await companyCollection.insertOne(newCompany);
            res.send(result);
        })

        app.patch('/api/companies/:id', logger, verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedCompany = req.body;

            const filter = { _id: new ObjectId(id) };
            const updateDocument = {
                $set: {
                    status: updatedCompany.status
                }
            }

            const result = await companyCollection.updateOne(filter, updateDocument);
            res.json(result);
        })

        // Plans related api
        app.get('/api/plans', async (req, res) => {
            const query = {};
            if (req.query.plan_id) {
                query.plan_id = req.query.plan_id;
            }

            const plan = await plansCollection.findOne(query);
            res.json(plan);
        })

        // Subscription related api
        app.post('/api/subscriptions', async (req, res) => {
            const subInfo = req.body;
            const newSubInfo = {
                ...subInfo,
                createdAt: new Date()
            }
            const result = await subscriptionCollection.insertOne(newSubInfo);

            // Update the user plan information
            const filter = { email: subInfo?.userEmail };
            const updateDocument = {
                $set: {
                    plan: subInfo?.planId
                }
            }

            const updateResult = await userCollection.updateOne(filter, updateDocument);
            res.send(updateResult);


        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
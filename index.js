const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();

// jwt
const jwt = require('jsonwebtoken');
// cookie parser
const cookieParser = require('cookie-parser');

const port = process.env.PORT || 3000;

require('dotenv').config();

// middleware
app.use(cors({
    origin: ['http://localhost:5173'], // allow requests from this origin
    credentials: true, // allow cookies to be sent
}));
app.use(express.json());
app.use(cookieParser());

// for varify (can place the require top)
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



const logger = (req, res, next) => {
    console.log('inside the logger middleware');
    next();
}

const verifyToken = (req, res, next) => {
    // we need cookies here
    const token = req?.cookies?.token;

    // check if token exists
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    // verify token
    jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        // console.log(decoded); // {email: '...', iat: ..., exp: ...}
        req.decoded = decoded; // we need this to match API request email with token email
        next();
    })
}

const verifyFirebaseToken = async (req, res, next) => {
    // console.log("Hit verify firebase token middleware");
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    // console.log('fb token', token);
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        // console.log('inside the token', decoded)
        req.decoded = decoded
        next();
    }
    catch (error) {
        console.error('Error verifying Firebase token:', error);
    }
}

// email duplication check middleware
const verifyTokenEmail = (req, res, next) => {
    // console.log("Hit verify token email middleware");
    if (req.query.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
    }
    next();
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dudbtcu.mongodb.net/?appName=Cluster0`;

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

        const jobsCollection = client.db('worklyDB').collection('jobs');
        const applicationsCollection = client.db('worklyDB').collection('applications');


        // jwt
        app.post('/jwt', async (req, res) => {
            const userData = req.body;
            const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, { expiresIn: '1d' });

            // set token in httpOnly cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: false, // set to true if using https
            }); // add options as needed

            // when using local storage in we pass the token in response body but in cookies we set the token in cookie
            res.send({ succes: true });
        });


        // jobs api
        app.get('/jobs', async (req, res) => {

            // if email found in query
            const email = req.query.email;
            const query = {};
            if (email) {
                query.hr_email = email;
            }

            const cursor = jobsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        // jobs by email
        // app.get('/jobsEmailAddress', async (req, res) => {
        //     const email = req.query.email;
        //     const query = { postedBy: email };
        //     const cursor = jobsCollection.find(query);
        //     const result = await cursor.toArray();
        //     res.send(result);
        // });

        app.get('/jobs/applications', verifyFirebaseToken, verifyTokenEmail, async (req, res) => {
            const email = req.query.email;

            // handled by middleware
            // if (email !== req.decoded.email) {
            //     return res.status(403).send({ message: 'forbidden access' });
            // }

            const query = { hr_email: email };
            const jobs = await jobsCollection.find(query).toArray();

            // should use aggregate to have optimum data fetching
            for (const job of jobs) {
                const applicationQuery = { jobId: job._id.toString() };
                const applications_count = await applicationsCollection.countDocuments(applicationQuery);
                job.applications_count = applications_count;
            }
            res.send(jobs);
        });

        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const job = await jobsCollection.findOne(query);
            res.send(job);
        });


        app.post('/jobs', async (req, res) => {
            const job = req.body;
            console.log(job);
            const result = await jobsCollection.insertOne(job);
            res.send(result);
        })





        // applications api

        app.get('/applications', verifyFirebaseToken, verifyTokenEmail, async (req, res) => {
            // console.log("hit the api");
            const email = req.query.email;
            // console.log("hit application");

            // console.log('inside applications', req.cookies);
            // if (email !== req.decoded.email) {
            //     return res.status(403).send({ message: 'forbidden access' });
            // }

            // if (req.tokenEmail !== req.decoded.email) {
            //     return res.status(403).send({ message: 'forbidden access' });
            // }

            // filter applications in db by email
            const query = { applicant: email };
            const result = await applicationsCollection.find(query).toArray();
            res.send(result)
        })

        // app.get('/applications/:id', async (req, res) => {

        // });
        app.get('/applications/job/:job_id', async (req, res) => {
            const job_id = req.params.job_id;
            const query = { jobId: job_id };
            result = await applicationsCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/applications', async (req, res) => {
            const application = req.body;
            // console.log(application);
            const result = await applicationsCollection.insertOne(application);
            res.send(result);
        });

        app.patch('/applications/:id', async (req, res) => {
            // const updated = req.body;
            const filter = { _id: new ObjectId(req.params.id) };
            const updatedDoc = {
                $set: {
                    status: req.body.status
                }
            }
            const result = await applicationsCollection.updateOne(filter, updatedDoc);
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






app.get('/', (req, res) => {
    res.send('Server is running...');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

require('dotenv').config();

// middleware
app.use(cors());
app.use(express.json());




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

        // jobs api
        app.get('/jobs', async (req, res) => {
            const cursor = jobsCollection.find();
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

        app.get('/applications', async (req, res) => {
            const email = req.query.email;
            // filter applications in db by email
            const query = { applicant: email };
            const result = await applicationsCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/applications', async (req, res) => {
            const application = req.body;
            // console.log(application);
            const result = await applicationsCollection.insertOne(application);
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
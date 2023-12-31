const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5174', 'https://home-service-app-ca7a7.web.app'],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.psdu9fg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middlewares
const logger = async (req, res, next) => {
    //console.log('called:', req.host, req.originalUrl)
    next();
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        //await client.connect();

        const serviceCollection = client.db('homeService').collection('services');
        //booking collection
        const bookingCollection = client.db('homeService').collection('bookings');
        //testimonial collection
        const testimonialCollection = client.db('homeService').collection('testimonials');
        //membership collection
        const membershipCollection = client.db('homeService').collection('members');

        //auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log(user);

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })



        })
        // services related api
        app.get('/services', async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/sortservices', async (req, res) => {
            try {
              let sort = {};
              if (req.query.sortOrder === 'asc') {
                sort = { servicePrice: 1 }; // Ascending
              } else if (req.query.sortOrder === 'desc') {
                sort = { servicePrice: -1 }; // Descending
              }
          
              // Retrieve the documents and convert to an array
              const services = await serviceCollection.find({}).sort(sort).toArray();
          
              res.json(services);
            } catch (error) {
              console.error("Error fetching services:", error);
              res.status(500).send("Error fetching services");
            }
          });
          

        

        app.get('/manageservices', verifyToken, async (req, res) => {

            //console.log(req.query.email);
            let query = {};
            if (req.query?.email) {
                query = { providerEmail: req.query.email }
            }
            const result = await serviceCollection.find(query).toArray();
            res.send(result);
        });

        app.delete('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await serviceCollection.deleteOne(query);
            res.send(result);
        })




        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.findOne(query);
            res.send(result);
        })

        app.post('/addServices', verifyToken, async (req, res) => {

            const service = req.body;
            console.log(service);
            const result = await serviceCollection.insertOne(service);
            res.send(result);
        });

        //update service
        app.put('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedService = req.body;
            const service = {
                $set: {
                    serviceName: updatedService.serviceName,
                    serviceImage: updatedService.serviceImage,
                    serviceArea: updatedService.serviceArea,
                    servicePrice: updatedService.servicePrice,
                    serviceDescription: updatedService.serviceDescription,
                    providerEmail: updatedService.providerEmail,

                }
            }
            const result = await serviceCollection.updateOne(query, service, options);
            res.send(result);
        })

        //booking api

        app.get('/bookings', verifyToken, async (req, res) => {

            // console.log('tok tok token', req.cookies.token)
            let query = {};

            // Fetch bookings made by the logged-in user
            if (req.query?.userEmail) {
                query['userEmail'] = req.query.userEmail;
            }

            // Fetch bookings where the logged-in user is the service provider
            if (req.query?.serviceProviderEmail) {
                query['serviceProviderEmail'] = req.query.serviceProviderEmail;
            }

            // If both userEmail and serviceProviderEmail are provided, use $or to fetch both sets of bookings
            if (req.query?.userEmail && req.query?.serviceProviderEmail) {
                query = {
                    $or: [
                        { userEmail: req.query.userEmail },
                        { serviceProviderEmail: req.query.serviceProviderEmail }
                    ]
                };
            }

            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        });


        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            booking.status = booking.status || 'pending';
            console.log(booking);
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedBooking = req.body;
            console.log(updatedBooking);
            const updateDoc = {
                $set: {
                    status: updatedBooking.status
                },
            };
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })



        //get all testimonials
        app.get('/testimonials', async (req, res) => {
            const cursor = testimonialCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        //post all testimonial

        app.post('/testimonials', async (req, res) => {
            const newTestimonial = req.body;
            const result = await testimonialCollection.insertOne(newTestimonial);
            res.send(result);
        });

        //loyalty program
        app.get('/members', async (req, res) => {
            const cursor = membershipCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/members/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await membershipCollection.findOne(query);
            res.send(result);
        })

        app.post('/members', async (req, res) => {
            const newMember = req.body;

            // Check if the user is already a member
            const existingMember = await membershipCollection.findOne({ userEmail: newMember.userEmail });
            if (existingMember) {
                return res.status(409).send({ message: "User is already a member." });
            }
        
            // Add new member to the database
            const result = await membershipCollection.insertOne(newMember);
        
            res.send(result);
        });

        // Send a ping to confirm a successful connection
       // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Home service is running')
})

app.listen(port, () => {
    console.log(`Home Service Server is running on port ${port}`)
})
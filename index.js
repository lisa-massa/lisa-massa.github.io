if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}

const express = require('express');
const { response } = require('express');
const path = require('path');
const mongoose = require('mongoose');
const engine = require('ejs-mate');
const session = require('express-session');
const flash = require('connect-flash');
const Joi = require('joi');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/users');
const helmet = require('helmet');

const { artworkSchema } = require('./schemas.js')
const Artwork = require('./models/artworks');
const ArtworkSchema = require('./models/artworks');
const artwork = require('./models/artworks');
const { ppid } = require('process');

const MongoDBStore = require("connect-mongodb-session")(session);

const mongoSanitize = require('express-mongo-sanitize');

const ExpressError = require('./utilities/ExpressError');
const catchAsync = require('./utilities/catchAsync');

const methodOverride = require('method-override');

const artworkRoutes = require('./routes/artworks');
const userRoutes = require('./routes/users');

const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/art-portfolio';

mongoose.connect(dbUrl);


const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const app = express();

app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static('public'));
app.use(mongoSanitize({
    replaceWith: '_'
}))

const secret = process.env.SECRET || 'thisshouldbeabettersecret';

const store = new MongoDBStore({
    url: dbUrl,
    secret,
    touchAfter: 24 * 60 * 60
});

store.on('error', function(e) {
    console.log('Session store error', e)
})

const sessionConfig = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}
app.use(session(sessionConfig))
app.use(flash());

const scriptSrcUrls = [
    "https://stackpath.bootstrapcdn.com/",
    "https://kit.fontawesome.com/",
    "https://cdnjs.cloudflare.com/",
    "https://cdn.jsdelivr.net",
    "https://res.cloudinary.com/dz0twneew/",
];
const styleSrcUrls = [
    "https://kit-free.fontawesome.com/",
    "https://stackpath.bootstrapcdn.com/",
    "https://fonts.googleapis.com/",
    "https://use.fontawesome.com/",
    "https://cdn.jsdelivr.net",
    "https://res.cloudinary.com/dz0twneew/"
];
const connectSrcUrls = [
    "https://res.cloudinary.com/dz0twneew/",
];
const fontSrcUrls = [];
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: [],
            connectSrc: ["'self'", ...connectSrcUrls],
            scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
            styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
            workerSrc: ["'self'", "blob:"],
            objectSrc: [],
            imgSrc: [
                "'self'",
                "blob:",
                "data:",
                "https://res.cloudinary.com/dz0twneew/",
                "https://images.unsplash.com/",
            ],
            fontSrc: ["'self'", ...fontSrcUrls],
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
        res.locals.currentUser = req.user;
        res.locals.success = req.flash('success');
        res.locals.error = req.flash('error');
        next();
    });

app.use('/', userRoutes);
app.use('/artwork', artworkRoutes);


app.get('/', (req, res) => {
    res.render('home')
})

app.get('/about', (req, res) => {
    res.render('about')
})

app.get('/events', (req, res) => {
    res.render('events')
})

app.get('/press', (req, res) => {
    res.render('press');
})

app.get('/login', (req, res) => {
    res.render('login');
})

app.get('/logout', (req, res)=> {
    res.render('home');
})

app.get('/signup', (req, res) => {
    res.render('signup');
})

// // INDEX 
// app.get('/artwork', catchAsync(async (req, res, next) => {
//     const artworks = await Artwork.find({});
//     res.render('artwork/index', { artworks })
// }))

// // NEW : remember to put it before show
// app.get('/artwork/new', (req, res) => {
//     res.render('artwork/new');
// })

// // POST : remember to put it before show
// app.post('/artwork', validateArtwork, catchAsync(async (req, res, next) => {
//     const artwork = new Artwork(req.body.artwork);
//     await artwork.save();
//     res.redirect(`/artwork/${artwork._id}`)
// }))

// // SHOW
// app.get('/artwork/:id', catchAsync(async (req, res, next) => {
//     const artwork = await Artwork.findById(req.params.id);
//     res.render('artwork/show', { artwork });
// }))

// // EDIT + UPDATE
// app.get('/artwork/:id/edit', catchAsync(async (req, res, next) => {
//     const artwork = await Artwork.findById(req.params.id);
//     res.render('artwork/edit', { artwork });
// }))

// app.put('/artwork/:id', validateArtwork, catchAsync(async (req, res, next) => {
//     const { id } = req.params;
//     const artwork = await Artwork.findByIdAndUpdate(id, { ...req.body.artwork }, { new: true });
//     res.redirect(`/artwork/${artwork._id}`)
// }))

// app.delete('/artwork/:id', catchAsync(async (req, res, next) => {
//     const { id } = req.params;
//     await Artwork.findByIdAndDelete(id);
//     res.redirect('/artwork');
// }))

app.all('*', (req, res, next) => {
    next(new ExpressError('Page not found', 404))
})

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh no, something went wrong!'
    res.status(statusCode).render('error', { err });
})

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serving on port ${port}`)
})

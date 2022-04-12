import express from 'express';
import bodyParser from "body-parser";
import cookieParser from 'cookie-parser'
import mongoose from "mongoose";
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from "./models/User.js";
import Comment from "./models/Comment.js";

import 'dotenv/config'

const corsOptions = {
    origin: "https://stately-figolla-9bafb6.netlify.app",
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization',
};

const uri = process.env.ATLAS_URI;
const db = mongoose.connection;
await mongoose.connect(uri, {useNewUrlParser: true, useUnifiedTopology:true });
db.once('open', () => {
    console.log('connection established');
})

const port = process.env.PORT;
const secret = process.env.TOKEN;
const app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(cors({
   corsOptions
}));


function getUserFromToken(token) {
    const userInfo = jwt.verify(token, secret);
    return User.findById(userInfo.id);
}

app.get('/', cors(corsOptions), (req, res) => {
    res.send('ok');
});

app.post('/register', cors(corsOptions),(req, res) => {
    const {email,username} = req.body;
    const password = bcrypt.hashSync(req.body.password, 10);
    const user = new User({email,username,password});
    user.save().then (() => {
        jwt.sign({id:user._id}, secret, (err, token) =>{
            if (err) {
                console.log(err);
                res.sendStatus(500);
            } else {
                res.status(201).cookie('token', token).send();
            }
        });
    }).catch(e => {
        console.log(e);
        res.sendStatus(500);
    });
});

app.get('/user', cors(corsOptions), (req, res) => {
   const token = req.cookies.token;

   getUserFromToken(token)
       .then(user => {
       res.json({username:user.username});
        })
       .catch(err => {
           console.log(err);
           res.sendStatus(500);
       });

   });

app.post('/login', cors(corsOptions), (req, res) => {
    const {username, password} = req.body;
    User.findOne({username}).then(user => {
        if (user && user.username) {
            const passOk = bcrypt.compareSync(password, user.password);
           if (passOk) {
               jwt.sign({id:user._id}, secret,(err, token) => {
                   res.cookie('token', token).send();
               });
           } else {
               res.status(422).json('Invalid username or password');
           }
        } else {
            res.status(422).json('Invalid username or password');
        }
    });
});

app.post('/logout', cors(corsOptions) , (req,res) => {
    res.cookie('token', '').send();
});

app.get('/comments', cors(corsOptions), (req, res) => {
    Comment.find({rootId:null}).sort({postedAt: -1}).then(comments => {
        res.json(comments);
    });
});

app.get('/comments/root/:rootId', cors(corsOptions), (req, res) => {
    Comment.find({rootId:req.params.rootId}).sort({postedAt: -1}).then(comments => {
        res.json(comments);
    });
});

app.get('/comments/:id', cors(corsOptions), (req, res) => {
    Comment.findById(req.params.id).then(comment => {
        res.json(comment);
        });
});

app.post('/comments', cors(corsOptions), (req, res) => {
    const token = req.cookies.token;
    if(!token) {
        res.sendStatus(401);
        return;
    }
    getUserFromToken(token)
        .then(userInfo => {
            const {title,body,parentId,rootId} = req.body;
            const comment = new Comment({
                title
                ,body
                ,author:userInfo.username,
                postedAt:new Date(),
                parentId,
                rootId,
            });
            comment.save().then(savedComment => {
                res.json(savedComment);
            }).catch(console.log);
    })
        .catch(() => {
            res.sendStatus(401);
        });
});


app.listen(port);
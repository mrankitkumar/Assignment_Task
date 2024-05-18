
const express=require("express");
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const bodyParser = require("body-parser");
const multer = require('multer');
const path = require('path');
const app=express();

app.set("view engine", "ejs");
app.use(express.static('public'));
app.use(cookieParser());


// app.use(cookiesparser);
app.use('/uploads', express.static('uploads'));
app.use(bodyParser.urlencoded({extented:false}));
const port=3000;
const JWT_SECRET = 'ankit';

const connection = mysql.createPool({
    connectionLimit:100,
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'user_auth_sql',
    debug:false

  });
  
  // connection.connect((err) => {
  //   if (err) {
  //     console.error('Error connecting to database:', err);
  //     return;
  //   }
  //   console.log('Connected to database');
  // });

// for uploading the document
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect('/');
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.redirect('/');
    }
    req.username = decoded.username;
    next();
  });
};

app.get('/admindashbord', verifyToken, async (req, res) => {
  try {
    const [userCountResult] = await connection.query('SELECT COUNT(*) AS count FROM users');
    const [productCountResult] = await connection.query('SELECT COUNT(*) AS count FROM products');

    const userCount = userCountResult[0].count;
    const productCount = productCountResult[0].count;

    res.render('admindashbord', { userCount, productCount });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).json({ error: 'Error loading dashboard' });
  }
});




//user see all the 
app.get('/dashboard', verifyToken, async (req, res) => {
  const { username } = req.username;
  const { search = '', page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;
    const [products] = await connection.query(
      'SELECT * FROM products WHERE name LIKE ? LIMIT ? OFFSET ?',
      [`%${search}%`, parseInt(limit), parseInt(offset)]
    );

    const [totalProducts] = await connection.query(
      'SELECT COUNT(*) as count FROM products WHERE name LIKE ?',
      [`%${search}%`]
    );

    const totalPages = Math.ceil(totalProducts[0].count / limit);

    res.render('dashboard', {
      username,
      products,
      search,
      currentPage: parseInt(page),
      totalPages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error loading user panel' });
  }
});



//admin add product
app.get('/product', verifyToken, async (req, res) => {
  try {
      const [products] = await connection.query('SELECT * FROM products');
      res.render('product', { products });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error loading products' });
  }
});



app.post('/product', verifyToken,upload.single('image'), async (req, res) => {
  try {
      const { name, price } = req.body;
      const image = req.file.filename;

      if (!name || !price || !image) {
          return res.status(400).json({ error: 'All fields are required' });
      }

      await connection.query('INSERT INTO products (name, image, price) VALUES (?, ?, ?)', [name, image, price]);
      res.redirect('/product');
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error adding product' });
  }
});
 

  //user landing page 
app.get('/',function(req,res)
{
    
   res.render('login');

});

//login user
app.post('/login', async (req, res) => {
  try {
      const { username, password } = req.body;

      if (!username || !password) {
          return res.status(400).render('login', { error: 'Username and password are required' });
      }

      const [results] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);

      if (results.length === 0) {
          return res.status(401).render('login', { error: 'Invalid username or password' });
      }

      const user = results[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
          return res.status(401).render('login', { error: 'Invalid username or password' });
      }

      const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true });

      if (username === "admin@gmail.com") {
          res.redirect('/admindashbord');
      } else {
          res.redirect('/dashboard');
      }
  } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).render('login', { error: 'Error logging in' });
  }
});






app.get('/register',function(req,res)
{
   res.render('register');

});


// Registration  user
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error registering user' });
  }
  

});

  // Logout 
  app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/'); 
  });
  


app.listen(port,()=>{

  console.log('port running 3000');
});
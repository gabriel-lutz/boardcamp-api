import express from "express";
import cors from "cors";
import pg from "pg";
import Joi from "joi"
import dayjs from "dayjs"

const app = express();
app.use(cors());
app.use(express.json());

const {Pool} = pg;
const connection  = new Pool(
    {
        user: 'bootcamp_role',
        password: 'senha_super_hiper_ultra_secreta_do_role_do_bootcamp',
        host: 'localhost',
        port: 5432,
        database: 'boardcamp'
    }
);

app.get('/categories', async (req,res)=>{
    try{
        const query = await connection.query('SELECT * FROM categories')
        res.send(query.rows)
    }catch(err){
        console.log(err)
        res.send(500)
    }
})

app.post('/categories', async (req,res)=>{
    try{
        const newCategorie = req.body.name
        const query = await connection.query('SELECT * FROM categories')
        if(!newCategorie.length){
            res.send(400)
            return;
        }else if(query.rows.length && query.rows.find(q => q.name === newCategorie)){
            res.send(409);
            return
        }
        await connection.query(`
            INSERT INTO categories (name) 
            VALUES ($1)`, [newCategorie])
        res.send(201)
    }catch(err){
        console.log(err)
        res.send(500)
    }
})

app.get('/games', async (req,res)=>{
    try{
        const gamesToFilter = req.query.name
        if(gamesToFilter){
            const query = await connection.query(`
                SELECT games.*, categories.name AS "categoryName" 
                FROM games JOIN categories
                ON games."categoryId" = categories.id
                WHERE name iLIKE  $1 || '%' `, [gamesToFilter])
            res.send(query.rows)
        }else{
            const query = await connection.query(`
                SELECT games.*, categories.name AS "categoryName" 
                FROM games JOIN categories
                ON games."categoryId" = categories.id`)
            res.send(query.rows)
        }
    }catch(err){
        console.log(err)
        res.send(500)
    }
})

app.post('/games', async (req,res)=>{
    try{
        const {name, image, stockTotal, categoryId, pricePerDay} = req.body
        const gamesQuery = await connection.query(`
            SELECT * 
            FROM games 
            WHERE name = $1`, [name])
        const categoriesQuery = await connection.query('SELECT * FROM categories')
        if(!name.length || stockTotal<=0 || pricePerDay <=0 || !categoriesQuery.rows.some(c=>c.id === categoryId)){
            res.send(401)
            return;
        }else if(gamesQuery.rows.length){
            res.send(409)
            return;
        }
        const query = await connection.query(`
            INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") 
            VALUES ($1, $2, $3, $4, $5)
            `, [name, image, stockTotal, categoryId, pricePerDay])
        res.send(200)
    }catch(err){
        console.log(err)
    }
})

app.get('/customers', async (req,res)=>{
    try{
        const cpfToFilter = req.query.cpf
        if(cpfToFilter){
            const query = await connection.query(`
                SELECT * FROM customers 
                WHERE cpf = $1
            `, [cpfToFilter+'%'])
            res.send(query.rows)
        }else{
            const query = await connection.query(`
                SELECT * FROM customers
            `)
            res.send(query.rows)
        }
    }catch(err){
        console.log(err)
        res.send(500)
    }
})

app.get('/customers/:id', async (req,res)=>{
    try{
        const id = req.params.id
        const query = await connection.query(`
            SELECT * 
            FROM customers 
            WHERE id = $1
        `, [id])
        if(!query.rows.length){
            res.send(404)
            return
        }
        res.send(query.rows)
    }catch(err){
        console.log(err)
        res.send(500)
    }
})

const customerSchema = Joi.object({
    cpf: Joi.string().length(11).pattern(/^[0-9]+$/).required(),
    phone: Joi.string().min(10).max(11).pattern(/^[0-9]+$/).required(),
    name: Joi.string().min(1).required(),
    birthday: Joi.date().less('now').required()
})

app.post('/customers', async (req,res)=>{
    try{   
        const {name, phone, cpf, birthday} = req.body
        const customersQuery = await connection.query(`
                SELECT * FROM customers
            `)
        if(customerSchema.validate({name, phone, cpf, birthday}).error){
            res.send(499)
            return
        }else if(customersQuery.rows.find(c => c.cpf === cpf)){
            res.send(409)
            return;
        }

        const query = await connection.query(`
            INSERT INTO customers (name, phone, cpf, birthday)
            VALUES ($1,$2,$3,$4)
        `, [name, phone, cpf, birthday])
        res.send(200)

    }catch(err){
        console.log(err)
        res.send(500)
    }
})

app.put('/customers/:id', async (req,res)=>{
    try{
        const id = req.params.id   
        const {name, phone, cpf, birthday} = req.body
        const customersQuery = await connection.query(`
                SELECT * FROM customers
            `)
        if(customerSchema.validate({name, phone, cpf, birthday}).error){
            res.send(400)
            return
        }else if(customersQuery.rows.find(c => c.cpf === cpf && c.id != id)){
            res.send(409)
            return;
        }

        const query = await connection.query(`
            UPDATE customers 
            SET (name, phone, cpf, birthday) = ($1,$2,$3,$4)
            WHERE id = $5
        `, [name, phone, cpf, birthday,id])
        res.send(200)
    }catch(err){
        console.log(err)
        res.send(500)
    }
})

app.get('/rentals', async (req,res)=>{
    try{
        const customerIdParam = req.query.customerId
        const gameIdParam = req.query.gameId
        let query;
        let gameQuery;
        let customerQuery;

        if(customerIdParam){
            query = await connection.query(`
                SELECT * FROM rentals WHERE "customerId"=$1
            `, [customerIdParam])
        }else if(gameIdParam){
            query = await connection.query(`
                SELECT * FROM rentals WHERE "gameId"=$1
            `, [gameIdParam])
        }else{
            query = await connection.query(`
                SELECT * FROM rentals
            `)
        }

        if(gameIdParam){
            gameQuery = await connection.query(`
                SELECT games.*, categories.name AS "categoryName" 
                FROM games 
                JOIN categories
                ON games."categoryId" = categories.id
                WHERE games.id = $1
            `, [gameIdParam])
        }else{
            gameQuery = await connection.query(`
                SELECT games.*, categories.name AS "categoryName" 
                FROM games JOIN categories
                ON games."categoryId" = categories.id
            `)
        }
        
        if(customerIdParam){
            customerQuery = await connection.query(`
                SELECT * 
                FROM customers
                WHERE customers.id = $1
            `, [customerIdParam])
        }else{
            customerQuery = await connection.query(`
                SELECT * FROM customers
            `)
        }
    
        const gameAndCustomerAddedArray = query.rows.map(r => {
            const game = gameQuery.rows.find(g => g.id === r.gameId)
            const customer = customerQuery.rows.find(c=> c.id === r.customerId)
            return {...r, 
                games:{id: game.id,
                       name: game.name,
                       categoryId: game.categoryId,
                       categoryName: game.categoryName
                },
                customer:{id: customer.id,
                          name: customer.name}
            }
        })

        res.send(gameAndCustomerAddedArray)
    }catch(err){
        console.log(err)
        res.send(500)
    }
})

app.post('/rentals', async (req,res)=>{
    try{
        const {customerId, gameId, daysRented} = req.body
        const rentDate =  dayjs().format('YYYY-MM-DD');
        const returnDate = null
        const delayFee = null

        if(+daysRented < 1){
            res.send(400)
            return
        }

        const customerQuery = await connection.query(`
            SELECT * 
            FROM customers 
            WHERE id = $1
        `, [customerId])

        if(!customerQuery.rows.length){
            res.send(400)
            return
        }

        const gameQuery = await connection.query(`
            SELECT * 
            FROM games 
            WHERE id = $1
        `, [gameId])

        if(!gameQuery.rows.length){
            res.send(400)
            return
        }

        const availableQuery = await connection.query(`
            SELECT * 
            FROM rentals 
            WHERE "gameId" = $1
        `, [gameId])

        if(gameQuery.rows[0].stockTotal <= availableQuery.rows.length){
            res.send(400)
            return;
        }

        const originalPrice = daysRented * gameQuery.rows[0].pricePerDay

        await connection.query(`
            INSERT INTO rentals ("customerId","gameId","rentDate",
                                 "daysRented","returnDate","originalPrice",
                                 "delayFee")
            VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [customerId,gameId,rentDate,
            daysRented,returnDate,originalPrice,
            delayFee])
        
        res.send(201)

    }catch(err){
        console.log(err)
        res.send(500)
    }
})

app.listen(4000, ()=>{
    console.log("O servidor está rodando na porta 4000...")
});
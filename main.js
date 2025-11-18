import express from 'express';
import { Command } from 'commander';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// --- 1. НАЛАШТУВАННЯ СЕРЕДОВИЩА ---

// Використовуємо main.js замість server.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name("WebBack-5")
  .version("1.0.0")
  .requiredOption('-h, --host <string>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу (uploads)');

program.parse(process.argv);
const options = program.opts();

const HOST = options.host;
const PORT = parseInt(options.port, 10);
const CACHE_DIR = options.cache;

const uploadPath = path.resolve(process.cwd(), CACHE_DIR);
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const app = express();

// --- 2. SWAGGER CONFIGURATION ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Inventory API',
            version: '1.0.0',
            description: 'API для управління інвентаризацією речей',
        },
        servers: [
            {
                url: `http://${HOST}:${PORT}`,
                description: 'Main Server'
            }
        ],
    },
    apis: ['./main.js'], // Вказуємо main.js
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// --- 3. MULTER & MIDDLEWARE ---

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'lab6'))); 

let inventoryDB = [];

// --- 4. РОУТИ З ВИПРАВЛЕНОЮ ДОКУМЕНТАЦІЄЮ ---

/**
 * @swagger
 * /inventory:
 * get:
 * summary: Отримати список всіх речей
 * responses:
 * 200:
 * description: Успішна відповідь зі списком
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * type: object
 */
app.get('/inventory', (req, res) => {
    res.json(inventoryDB);
});

/**
 * @swagger
 * /register:
 * post:
 * summary: Зареєструвати нову річ
 * requestBody:
 * required: true
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * inventory_name:
 * type: string
 * description: Обов'язкова назва речі.
 * description:
 * type: string
 * description: Детальний опис.
 * photo:
 * type: string
 * format: binary
 * description: Файл зображення.
 * responses:
 * 201:
 * description: Створено успішно.
 * 400:
 * description: Не вказано ім'я.
 */
app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
        return res.status(400).json({ message: 'Bad Request: inventory_name is required' });
    }

    const newItem = {
        id: Date.now().toString(),
        inventory_name,
        description: description || '',
        photo: req.file ? req.file.filename : null 
    };

    inventoryDB.push(newItem);
    res.status(201).json({ message: 'Item registered', item: newItem });
});

/**
 * @swagger
 * /inventory/{id}:
 * get:
 * summary: Отримати інформацію про річ за ID
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: Унікальний ID речі.
 * responses:
 * 200:
 * description: Інформація про річ
 * 404:
 * description: Річ не знайдено
 */
app.get('/inventory/:id', (req, res) => {
    const item = inventoryDB.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Not Found' });
    
    const responseItem = { ...item };
    if (item.photo) {
        responseItem.photoUrl = `http://${HOST}:${PORT}/inventory/${item.id}/photo`;
    }
    res.json(responseItem);
});

/**
 * @swagger
 * /inventory/{id}:
 * put:
 * summary: Оновити дані речі
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID речі.
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * inventory_name:
 * type: string
 * description:
 * type: string
 * responses:
 * 200:
 * description: Оновлено успішно
 * 404:
 * description: Річ не знайдено
 */
app.put('/inventory/:id', (req, res) => {
    const item = inventoryDB.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Not Found' });

    const { inventory_name, description } = req.body;
    
    if (inventory_name) item.inventory_name = inventory_name;
    if (description !== undefined) item.description = description;

    res.json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 * delete:
 * summary: Видалити річ
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID речі.
 * responses:
 * 200:
 * description: Видалено успішно
 * 404:
 * description: Річ не знайдено
 */
app.delete('/inventory/:id', (req, res) => {
    const index = inventoryDB.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Not Found' });

    inventoryDB.splice(index, 1);
    res.status(200).json({ message: 'Item deleted' });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 * get:
 * summary: Отримати фото речі
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID речі.
 * responses:
 * 200:
 * description: Зображення
 * content:
 * image/jpeg:
 * schema:
 * type: string
 * format: binary
 * 404:
 * description: Фото або річ не знайдено
 */
app.get('/inventory/:id/photo', (req, res) => {
    const item = inventoryDB.find(i => i.id === req.params.id);
    
    if (!item || !item.photo) {
        return res.status(404).json({ message: 'Not found or no photo' });
    }

    const filePath = path.join(uploadPath, item.photo);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ message: 'Photo file missing on disk' });
    }
});

/**
 * @swagger
 * /inventory/{id}/photo:
 * put:
 * summary: Оновити фото речі
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID речі.
 * requestBody:
 * required: true
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * photo:
 * type: string
 * format: binary
 * responses:
 * 200:
 * description: Фото оновлено
 */
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventoryDB.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Not Found' });

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    item.photo = req.file.filename;
    res.json({ message: 'Photo updated', item });
});

/**
 * @swagger
 * /search:
 * post:
 * summary: Пошук речі за ID (Form URL Encoded)
 * requestBody:
 * required: true
 * content:
 * application/x-www-form-urlencoded:
 * schema:
 * type: object
 * properties:
 * id:
 * type: string
 * has_photo:
 * type: string
 * responses:
 * 200:
 * description: Знайдена річ
 * 404:
 * description: Не знайдено
 */
app.post('/search', (req, res) => {
    const { id, has_photo } = req.body;
    const item = inventoryDB.find(i => i.id === id);

    if (!item) {
        return res.status(404).json({ message: 'Not Found' });
    }

    const responseItem = { ...item };
    if (has_photo === 'on' || has_photo === 'true') {
        if (item.photo) {
             responseItem.photoLink = `http://${HOST}:${PORT}/inventory/${item.id}/photo`;
        } else {
             responseItem.photoLink = "No photo available";
        }
    }

    res.json(responseItem);
});


// --- 405/404 Handlers ---

app.use((req, res, next) => {
    const knownPaths = ['/inventory', '/register', '/search'];
    const pathBase = req.path.split('/')[1];
    if (knownPaths.includes('/' + pathBase) && req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
         return res.status(405).send('Method Not Allowed');
    }
    next();
});

app.use((req, res) => {
    res.status(404).send('Not Found');
});

// --- 5. ЗАПУСК ---
app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`Docs available at http://${HOST}:${PORT}/docs`); 
    console.log(`Cache dir: ${uploadPath}`);
});
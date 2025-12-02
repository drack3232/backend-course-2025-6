import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import swaggerUi from 'swagger-ui-express'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let swaggerDocument = {};
try {
    const swaggerPath = path.join(__dirname, 'swagger.json');
    const swaggerContent = fs.readFileSync(swaggerPath, 'utf8');
    swaggerDocument = JSON.parse(swaggerContent);
} catch (error) {
    console.error(`Помилка завантаження swagger.json: ${error.message}`);
}

const host = 'localhost'; 
const port = 3000; 
const CACHE_DIR_NAME = 'lab6/uploads';

const UPLOAD_PATH_ABSOLUTE = path.join(__dirname, CACHE_DIR_NAME); 

if (!fs.existsSync(UPLOAD_PATH_ABSOLUTE)) {
    fs.mkdirSync(UPLOAD_PATH_ABSOLUTE, { recursive: true });
    console.log(`Сервер: Директорія завантажень створена: ${UPLOAD_PATH_ABSOLUTE}`);
}

const app = express();
let inventoryDB = []; 

const deleteFileIfExist = (filename) => {
    if (filename) {
        const filePath = path.join(UPLOAD_PATH_ABSOLUTE, filename);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error(`Помилка видалення файлу ${filename}: ${error.message}`);
        }
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, UPLOAD_PATH_ABSOLUTE); },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'lab6')));
if (Object.keys(swaggerDocument).length > 0) {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

app.get('/inventory', (req, res) => {
    
    const itemsWithUrls = inventoryDB.map(item => ({
        ...item,
        photoUrl: item.photo 
            ? `http://${host}:${port}/inventory/${item.id}/photo` 
            : null
    }));
    
    res.json({ count: itemsWithUrls.length, items: itemsWithUrls });
});

app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
        if (req.file) { deleteFileIfExist(req.file.filename); }
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

app.get('/inventory/:id', (req, res) => {
    const item = inventoryDB.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Not Found' });
    
    const responseItem = { ...item };
    if (item.photo) {
        responseItem.photoUrl = `http://${host}:${port}/inventory/${item.id}/photo`;
    }
    res.json(responseItem);
});

app.put('/inventory/:id', (req, res) => {
    const item = inventoryDB.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Not Found' });

    const { inventory_name, description } = req.body;
    
    if (inventory_name) item.inventory_name = inventory_name;
    if (description !== undefined) item.description = description; 

    res.json({ message: 'Item updated', item });
});

app.delete('/inventory/:id', (req, res) => {
    const index = inventoryDB.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Not Found' });
    
    const deletedItem = inventoryDB[index];
    deleteFileIfExist(deletedItem.photo);

    inventoryDB.splice(index, 1);
    res.status(200).json({ message: 'Item deleted' });
});

app.get('/inventory/:id/photo', (req, res) => {
    const item = inventoryDB.find(i => i.id === req.params.id);
    
    if (!item || !item.photo) {
        return res.status(404).json({ message: 'Not found or no photo' });
    }

    const filePath = path.join(UPLOAD_PATH_ABSOLUTE, item.photo);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ message: 'Photo file missing on disk' });
    }
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventoryDB.find(i => i.id === req.params.id);
    if (!item) {
        if (req.file) { deleteFileIfExist(req.file.filename); }
        return res.status(404).json({ message: 'Not Found' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    
    deleteFileIfExist(item.photo);

    item.photo = req.file.filename;
    res.json({ message: 'Photo updated', item });
});

app.post('/search', (req, res) => {
    const { id, has_photo } = req.body;
    const item = inventoryDB.find(i => i.id === id);

    if (!item) {
        return res.status(404).json({ message: 'Not Found' });
    }

    const responseItem = { ...item };
    if (has_photo === 'on' || has_photo === 'true') {
        if (item.photo) {
             responseItem.photoLink = `http://${host}:${port}/inventory/${item.id}/photo`;
        } else {
             responseItem.photoLink = "No photo available";
        }
    }

    res.json(responseItem);
});


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

app.listen(port, host, () => {
    console.log(`\n--- Inventory API Service ---`);
    console.log(`Сервіс запущено: http://${host}:${port}`);
    if (Object.keys(swaggerDocument).length > 0) {
        console.log(`Документація Swagger: http://${host}:${port}/docs`); 
    } else {
        console.log('Попередження: Документація Swagger не завантажена. Перевірте swagger.json.');
    }
    console.log(`--- Ready to serve ---`);
});
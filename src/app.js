import express from "express";
import urlRoutes from "./routes/urlRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
const app = express();

app.use(express.json());
app.use("/", urlRoutes);
app.use(errorHandler);
app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

export default app;
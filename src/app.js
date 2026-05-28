import express from "express";
import urlRoutes from "./routes/urlRoutes.js";

const app = express();

app.use(express.json());
app.use("/", urlRoutes);

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

export default app;
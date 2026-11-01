import { Router } from "express";
import {
	getFyersInstrumentSyncStatus,
	optionChain,
	optionChainSchema,
	getCandles,
	candlesSchema,
	search,
	searchSchema,
	syncFyersInstruments,
} from "../controllers/instrument.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

router.use(requireAuth);
router.post("/sync/fyers", syncFyersInstruments);
router.get("/sync/fyers/:jobId", getFyersInstrumentSyncStatus);
router.get("/search", validate(searchSchema), search);
router.get("/option-chain", validate(optionChainSchema), optionChain);
router.get("/candles", validate(candlesSchema), getCandles);

export default router;

import { AppError } from "../utils/AppError.js";
import { FyersBrokerAdapter } from "./FyersBrokerAdapter.js";
import { ZerodhaBrokerAdapter } from "./ZerodhaBrokerAdapter.js";

const adapters = {
  fyers: FyersBrokerAdapter,
  zerodha: ZerodhaBrokerAdapter,
};

export class BrokerFactory {
  static getBroker(brokerName) {
    const Adapter = adapters[String(brokerName).toLowerCase()];

    if (!Adapter) {
      throw new AppError(`Unsupported broker: ${brokerName}`, 400);
    }

    return new Adapter();
  }
}

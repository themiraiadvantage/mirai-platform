require("dotenv/config");
const { randomUUID } = require("node:crypto");
const { PaystackService } = require("../dist/payments/paystack.service");
(async () => {
  const gateway = new PaystackService();
  const reference = `MIRAI-${randomUUID().replaceAll("-", "")}`;
  const url = await gateway.initialize("test@example.com", 3000000, reference);
  if (new URL(url).origin !== "https://checkout.paystack.com")
    throw new Error("Unexpected checkout origin");
  const result = await gateway.verify(reference);
  if (
    result.reference !== reference ||
    result.amount !== 3000000 ||
    result.currency !== "NGN" ||
    result.domain !== "test" ||
    result.status === "success"
  )
    throw new Error("Unexpected test transaction response");
  console.log(
    "Paystack test API connected. NGN 30,000 checkout initialized and verified as unpaid. No charge was made. Keys and checkout URL withheld.",
  );
})().catch(() => {
  console.error("Paystack test API check failed. Check the backend keys and network connection.");
  process.exitCode = 1;
});

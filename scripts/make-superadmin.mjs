import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://reminiscent-panda-57.convex.cloud");

async function makeSuperadmin() {
  try {
    const result = await client.mutation("users:makeSuperadmin", {
      email: "hello@jacksenn.me"
    });
    console.log("✅ Success!", result);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

makeSuperadmin();


import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://reminiscent-panda-57.convex.cloud");

async function activateAllUsers() {
  try {
    const result = await client.mutation("users:activateAllUsers");
    console.log("✅ Success!", result);
    console.log(`\nActivated ${result.activated} users:`);
    result.users.forEach(user => {
      console.log(`  - ${user.email || user.name || 'Unknown'}`);
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

activateAllUsers();






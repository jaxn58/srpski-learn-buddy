import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://reminiscent-panda-57.convex.cloud");

async function makeAllBetaTesters() {
  try {
    const result = await client.mutation("users:makeAllUsersBetaTesters");
    console.log("✅ Success!", result);
    console.log(`\n📊 Stats:`);
    console.log(`   Total users: ${result.totalUsers}`);
    console.log(`   Updated: ${result.updated}`);
    
    if (result.users.length > 0) {
      console.log(`\n✨ Added beta badge to:`);
      result.users.forEach(user => {
        console.log(`   - ${user.email || user.name || 'Unknown'} (${user.role})`);
      });
    } else {
      console.log(`\n✨ All users already have the beta badge!`);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

makeAllBetaTesters();





















import { ethers } from "hardhat";

async function main() {
  // Define the three validator addresses (replace with your test accounts)
  // For now, we'll use the deployer's address three times. You can update later.
  const [deployer, validator1, validator2, validator3, organizer1] = await ethers.getSigners();

  console.log("Deploying contract with deployer:", deployer.address);

  const validators = [validator1.address, validator2.address, validator3.address];
  const organizers = [organizer1.address];

  const ReliefChain = await ethers.getContractFactory("ReliefChain");
  const reliefChain = await ReliefChain.deploy(validators, organizers);

  await reliefChain.waitForDeployment();
  const contractAddress = await reliefChain.getAddress();

  console.log("✅ ReliefChain deployed to:", contractAddress);
  console.log("Network: Polygon Amoy Testnet");
  console.log("Validators:", validators);
  console.log("Organizers:", organizers);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
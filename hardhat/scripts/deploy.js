const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with:", deployer.address);

  // For demo purposes, use the same address for all validators and organizer
  const validators = [deployer.address, deployer.address, deployer.address];
  const organizers = [deployer.address];

  const ReliefChain = await ethers.getContractFactory("ReliefChain");
  const reliefChain = await ReliefChain.deploy(validators, organizers);

  // For ethers v5, use .deployed() instead of .waitForDeployment()
  await reliefChain.deployed();

  console.log("✅ ReliefChain deployed to:", reliefChain.address);
  console.log("Validators (demo):", validators);
  console.log("Organizers:", organizers);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
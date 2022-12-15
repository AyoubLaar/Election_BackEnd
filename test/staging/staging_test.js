const { assert } = require("chai");
const { network, ethers, getNamedAccounts } = require("hardhat");
const { developpementChains } = require("../../Config");

const GASLIMIT = 10e6;

developpementChains.includes(network.name)
    ? describe.skip
    : describe("Staging test !", () => {
          let Election, ElectionHelper, deployer, helper;
          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer;
              helper = (await getNamedAccounts()).helper;
              ElectionHelper = await ethers.getContract("Election", helper);
              Election = await ethers.getContract("Election", deployer);
          });
          it("Should ResetElection (!!if owner) , allow selfElection , emit event with winner !", async () => {
              console.log("Setting up test!");
              let tx = await Election.Reset_Election("15", {
                  gasLimit: GASLIMIT,
              }); //SMALL INTERVAL!
              let tr = tx.wait("1");
              tx = await Election.selfElect({
                  gasLimit: GASLIMIT,
              });
              tr = tx.wait("1");
              tx = await ElectionHelper.vote(deployer, {
                  gasLimit: GASLIMIT,
              });
              tr = tx.wait("1");
              await new Promise(async (resolve, reject) => {
                  console.log("Awaiting Promise !");
                  Election.once("Election_end", async (winner, votes) => {
                      console.log("Event emited!");
                      try {
                          console.log("trying !");
                          console.log(winner);
                          assert(winner == deployer);
                      } catch (e) {
                          console.error(e);
                          reject();
                      }
                      resolve();
                  });
              });
          });
      });

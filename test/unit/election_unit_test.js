const { network, deployments, ethers, getNamedAccounts } = require("hardhat");
const { assert, expect } = require("chai");
const { networkConfig, developpementChains } = require("../../Config.js");
const { resolveConfig } = require("prettier");

const CHAINID = network.config.chainId;

!developpementChains.includes(network.name.toLowerCase())
    ? describe.skip
    : describe("Election unit test", () => {
          beforeEach(async () => {
              await deployments.fixture(["all", "mocks"]);
          });
          describe("Constructor !", () => {
              let Election,
                  vrfV2Mock,
                  NamedAccounts,
                  i_owner,
                  i_coordinator,
                  s_electionState,
                  s_electionStart,
                  s_electionDuration,
                  i_subId,
                  i_keyHash,
                  i_callbackGasLimit,
                  i_minimumRequestConfirmations;
              beforeEach(async () => {
                  NamedAccounts = await getNamedAccounts();
                  Election = await ethers.getContract("Election");
                  vrfV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
                  i_owner = await Election.get_owner();
                  i_coordinator = await Election.get_coordinator();
                  s_electionState = await Election.get_electionState();
                  s_electionStart = await Election.get_electionStart();
                  s_electionDuration = await Election.get_electionDuration();
                  i_subId = await Election.get_subId();
                  i_keyHash = await Election.get_keyHash();
                  i_callbackGasLimit = await Election.get_callbackGasLimit();
                  i_minimumRequestConfirmations =
                      await Election.get_minimumRequestConfirmations();
              });
              it("should initialize the contract variables correctly !", async () => {
                  let i_owner_isCorrect = i_owner == NamedAccounts.deployer,
                      i_coordinator_isCorrect =
                          i_coordinator == vrfV2Mock.address,
                      s_electionState_isCorrect = s_electionState == 0,
                      s_electionDuration_isCorrect =
                          s_electionDuration ==
                          networkConfig[CHAINID]["interval"],
                      i_keyHash_isCorrect =
                          i_keyHash == networkConfig[CHAINID]["keyHash"],
                      i_callbackGasLimit_isCorrect =
                          i_callbackGasLimit ==
                          networkConfig[CHAINID]["callBackGasLimit"],
                      i_minimumRequestConfirmations_isCorrect =
                          i_minimumRequestConfirmations ==
                          networkConfig[CHAINID]["minimumRequestConfirmations"];
                  assert(
                      i_owner_isCorrect &&
                          i_coordinator_isCorrect &&
                          s_electionState_isCorrect &&
                          s_electionDuration_isCorrect &&
                          i_keyHash_isCorrect &&
                          i_callbackGasLimit_isCorrect &&
                          i_minimumRequestConfirmations_isCorrect
                  );
              });
          });

          describe("self electing !", async () => {
              let Election, vrfV2Mock, deployer;
              beforeEach(async () => {
                  deployer = (await getNamedAccounts()).deployer;
                  Election = await ethers.getContract("Election");
                  vrfV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
              });
              it("Should show the candidate is electing !", async () => {
                  await Election.selfElect();
                  const CandidateIsElecting =
                      await Election.get_candidatetovotes(deployer);
                  const candidate = await Election.get_candidates("0");
                  assert(CandidateIsElecting == 1 && candidate == deployer);
              });
              it("Shouldn't allow the candidate to self elect twice !", async () => {
                  await Election.selfElect();
                  try {
                      await Election.selfElect();
                  } catch (e) {
                      if (
                          e
                              .toString()
                              .includes("Election_already_a_candidate()")
                      ) {
                          assert(true);
                      } else {
                          assert(false);
                          console.error(e);
                      }
                  }
              });
              it("Shouldn't allow selfElection when the election is closed !", async () => {
                  await Election.selfElect();
                  const accounts = await ethers.getSigners();
                  for (let i = 0; i < 5; i++) {
                      Election = Election.connect(accounts[i + 1]);
                      await Election.vote(accounts[0].address);
                  }
                  //WinningCandidates is not empty , it has the deployer
                  await network.provider.send("evm_increaseTime", [
                      networkConfig[CHAINID]["interval"] + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  //enough Time has passed and election state is open
                  //=> We can call performUpkeep
                  await Election.performUpkeep("0x");
                  //election State should be set to state.close
                  try {
                      await Election.selfElect();
                  } catch (e) {
                      if (e.toString().includes("Election_closed()")) {
                          assert(true);
                      } else {
                          console.error(e);
                          assert(false);
                      }
                  }
              });
          });
          describe("Voting !", () => {
              let Election, vrfV2Mock, deployer;
              beforeEach(async () => {
                  deployer = (await getNamedAccounts()).deployer;
                  Election = await ethers.getContract("Election");
                  vrfV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
              });
              it("Shouldn't accept votes for non candidates!", async () => {
                  try {
                      await Election.vote(deployer);
                  } catch (e) {
                      if (
                          e
                              .toString()
                              .includes("Election_candidate_not_a_candidate()")
                      ) {
                      } else {
                          assert(false);
                          console.error(e);
                      }
                  }
              });
              it("Should increment votes for candidates !", async () => {
                  await Election.selfElect(); //deployer self elects
                  const INITIAL_NUMBER_OF_VOTES =
                      await Election.get_candidatetovotes(deployer);
                  const accounts = await ethers.getSigners();
                  Election = Election.connect(accounts[1]);
                  await Election.vote(deployer); //accounts[1] votes for deployer
                  const CURRENT_NUMBER_OF_VOTES =
                      await Election.get_candidatetovotes(deployer);
                  assert.equal(
                      INITIAL_NUMBER_OF_VOTES.add(1).toString(),
                      CURRENT_NUMBER_OF_VOTES.toString()
                  );
              });
              it("Shouldn't allow voting twice !", async () => {
                  await Election.selfElect(); //deployer self elects
                  const accounts = await ethers.getSigners();
                  Election = Election.connect(accounts[1]);
                  await Election.vote(deployer); //account 1 votes for deployer
                  try {
                      await Election.vote(deployer); //account 1 votes for deployer again
                  } catch (e) {
                      if (
                          e.toString().includes("Election_has_already_voted()")
                      ) {
                          assert(true);
                      } else {
                          console.error(e);
                          assert(false);
                      }
                  }
              });

              it("Shouldn't allow a Candidate to vote !", async () => {
                  await Election.selfElect();
                  try {
                      await Election.vote(deployer);
                  } catch (e) {
                      if (
                          e.toString().includes("Election_has_already_voted()")
                      ) {
                          assert(true);
                      } else {
                          assert(false);
                      }
                  }
              });

              it("Should change topVotes and the winning candidate when the highest votes is surpassed !", async () => {
                  await Election.selfElect();
                  //TopVotes should be equal to one , when you selfElect it is considered as a vote to oneself .
                  const accounts = await ethers.getSigners();
                  const candidateTwo = accounts[1];
                  let ElectionConnected = await Election.connect(candidateTwo);
                  await ElectionConnected.selfElect();
                  //candidateTwo votes should be set to 1
                  for (let i = 2; i < accounts.length; i++) {
                      ElectionConnected = await Election.connect(accounts[i]);
                      await ElectionConnected.vote(candidateTwo.address);
                  }
                  //candidateTwo votes should be set to 1 + accounts.length - 2
                  const TopVotes = await Election.get_topVotes();
                  const WinningCandidate = await Election.get_WinningCandidates(
                      "0"
                  );
                  assert(
                      TopVotes._hex ==
                          TopVotes.add(1 + accounts.length - 2).sub(TopVotes)
                              ._hex && WinningCandidate == candidateTwo.address
                  );
              });

              it("if two candidates have the top votes , they should both be pushed to the WinningCandidates array", async () => {
                  await Election.selfElect(); //Top votes should be 0
                  const accounts = await ethers.getSigners();
                  Election = await Election.connect(accounts[1]);
                  await Election.selfElect(); //Top votes should still be 0 since no one voted
                  //No winningCandidates yet !
                  for (let i = 0; i < 2; i++) {
                      Election = await Election.connect(accounts[i + 2]);
                      await Election.vote(accounts[i].address);
                      //accounts[0] and accounts[1] get added to winning candidates
                  }
                  const WinningCandidate1 =
                      await Election.get_WinningCandidates("0");
                  const WinningCandidate2 =
                      await Election.get_WinningCandidates("1");
                  assert(
                      WinningCandidate1 == accounts[0].address &&
                          WinningCandidate2 == accounts[1].address
                  );
              });
          });

          describe("CheckUpkeep", () => {
              let Election, vrfV2Mock, accounts, interval;
              beforeEach(async () => {
                  accounts = await ethers.getSigners();
                  Election = await ethers.getContract("Election", accounts[0]);
                  vrfV2Mock = await ethers.getContract(
                      "VRFCoordinatorV2Mock",
                      accounts[0]
                  );
                  interval = await Election.get_electionDuration();
              });

              it("Should return false if not enough time has passed !", async () => {
                  await Election.selfElect();
                  for (let i = 0; i < 5; i++) {
                      Election = Election.connect(accounts[i + 1]);
                      Election.vote(accounts[0].address);
                  }
                  const upkeepNeeded = await Election.checkUpkeep("0x");
                  assert(!upkeepNeeded.upkeepNeeded);
              });

              it("Should return false if no winning candidate !", async () => {
                  await Election.selfElect();
                  await network.provider.send("evm_increaseTime", [
                      networkConfig[CHAINID]["interval"] + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  //enough time has passed and the election state is open and no winning candidate
                  const upkeepNeeded = (await Election.checkUpkeep("0x"))
                      .upkeepNeeded;
                  assert(!upkeepNeeded);
              });

              it("Should return false if state closed !", async () => {
                  await Election.selfElect();
                  for (let i = 0; i < 5; i++) {
                      Election = Election.connect(accounts[i + 1]);
                      Election.vote(accounts[0].address);
                  }
                  await network.provider.send("evm_increaseTime", [
                      networkConfig[CHAINID]["interval"] + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  //enough time has passed and the election state is open and no winning candidate
                  //We can call performUpkeep
                  await Election.performUpkeep("0x");
                  //electionState is closed !
                  const upkeepNeeded = (await Election.checkUpkeep("0x"))
                      .upkeepNeeded;
                  assert(!upkeepNeeded);
              });

              it("Should return true if all conditions are verifed !", async () => {
                  await Election.selfElect();
                  for (let i = 0; i < 5; i++) {
                      Election = Election.connect(accounts[i + 1]);
                      Election.vote(accounts[0].address);
                  }
                  await network.provider.send("evm_increaseTime", [
                      networkConfig[CHAINID]["interval"] + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const upkeepNeeded = (await Election.checkUpkeep("0x"))
                      .upkeepNeeded;
                  assert(upkeepNeeded);
              });
          });

          describe("PerformUpKeep", () => {
              let Election, vrfV2Mock, accounts;
              beforeEach(async () => {
                  accounts = await ethers.getSigners();
                  Election = await ethers.getContract("Election", accounts[0]);
                  vrfV2Mock = await ethers.getContract(
                      "VRFCoordinatorV2Mock",
                      accounts[0]
                  );
              });
              it("Should make the election state close and emit a winner event when only one winning candidate", async () => {
                  await Election.selfElect();
                  const Winner = Election.signer.address;
                  for (let i = 0; i < 5; i++) {
                      Election = Election.connect(accounts[i + 1]);
                      Election.vote(accounts[0].address);
                  }
                  const TopVotes = await Election.get_topVotes();
                  await network.provider.send("evm_increaseTime", [
                      networkConfig[CHAINID]["interval"] + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const tx = await Election.performUpkeep("0x");
                  const tr = await tx.wait("1");
                  const electionState = await Election.get_electionState();
                  assert(
                      electionState == 1 &&
                          Winner == tr.events[0].args.winner &&
                          TopVotes._hex == tr.events[0].args.votes._hex
                  );
              });

              it("Should request a random number when there is more than a winning candidate", async () => {
                  await Election.selfElect();
                  Election = Election.connect(accounts[1]);
                  await Election.selfElect();
                  for (let i = 0; i < 5; i++) {
                      Election = Election.connect(accounts[i + 2]);
                      //i + 2 , because accounts 0 and 1 are candidates !
                      Election.vote(accounts[0].address);
                      Election = Election.connect(accounts[i + 2 + 5]);
                      //i + 2 + 5 , so that the accounts don't overlap !
                      Election.vote(accounts[1].address);
                  }
                  const Winner1Votes = await Election.get_candidatetovotes(
                      accounts[0].address
                  );
                  const Winner2Votes = await Election.get_candidatetovotes(
                      accounts[1].address
                  );
                  const Winner1 = await Election.get_WinningCandidates("0");
                  const Winner2 = await Election.get_WinningCandidates("1");
                  const TopVotes = await Election.get_topVotes();
                  await network.provider.send("evm_increaseTime", [
                      networkConfig[CHAINID]["interval"] + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  Election = Election.connect(accounts[0]);
                  //deployer is the owner of the subId , only he can call the requestRandomWords
                  //Election is a consumer from the deploying of the contract !
                  const tx = await Election.performUpkeep("0x");
                  const tr = await tx.wait("1");
                  assert(
                      tr.events[1].event.toLowerCase() == "randomwordsrequested"
                  );
              });
          });

          describe("FullfillRandomWords", () => {
              let Election, vrfV2Mock, accounts;
              beforeEach(async () => {
                  accounts = await ethers.getSigners();
                  Election = await ethers.getContract("Election", accounts[0]);
                  vrfV2Mock = await ethers.getContract(
                      "VRFCoordinatorV2Mock",
                      accounts[0]
                  );
              });
              it("should determine the winner randomly !", async () => {
                  await Election.selfElect();
                  Election = Election.connect(accounts[1]);
                  await Election.selfElect();
                  for (let i = 0; i < 5; i++) {
                      Election = Election.connect(accounts[i + 2]);
                      //i + 2 , because accounts 0 and 1 are candidates !
                      Election.vote(accounts[0].address);
                      Election = Election.connect(accounts[i + 2 + 5]);
                      //i + 2 + 5 , so that the accounts don't overlap !
                      Election.vote(accounts[1].address);
                  }
                  const Winner1 = await Election.get_WinningCandidates("0");
                  const Winner2 = await Election.get_WinningCandidates("1");
                  await network.provider.send("evm_increaseTime", [
                      networkConfig[CHAINID]["interval"] + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  Election = Election.connect(accounts[0]);
                  //deployer is the owner of the subId , only he can call the requestRandomWords
                  //Election is a consumer from the deploying of the contract !
                  await new Promise(async (resolve, reject) => {
                      Election.once("Election_end", async () => {
                          try {
                              const DeclaredWinner =
                                  await Election.get_RecentWinner();
                              assert(
                                  DeclaredWinner == Winner1 ||
                                      DeclaredWinner == Winner2
                              );
                          } catch (e) {
                              console.error(e);
                              reject();
                          }
                          resolve();
                      });
                      const tx = await Election.performUpkeep("0x");
                      const tr = await tx.wait("1");
                      await vrfV2Mock.fulfillRandomWords(
                          tr.events[1].args.requestId,
                          Election.address
                      );
                  });
              });

              describe("Reset_Election", () => {
                  let Election, vrfV2Mock, owner, accounts;
                  beforeEach(async () => {
                      accounts = await ethers.getSigners();
                      owner = (await getNamedAccounts()).deployer;
                      Election = await ethers.getContract("Election", owner);
                      vrfV2Mock = await ethers.getContract(
                          "VRFCoordinatorV2Mock",
                          owner
                      );
                  });

                  it("should only be called after the current election is fulfilled (fulfillRandomWords)", async () => {
                      try {
                          await Election.Reset_Election("30");
                      } catch (e) {
                          if (
                              e
                                  .toString()
                                  .includes(
                                      "Election_fullfillRandomWords_not_called_yet()"
                                  )
                          ) {
                              assert(true);
                          } else {
                              console.error(e);
                              assert(false);
                          }
                      }
                  });
                  it("Can only be called by the owner", async () => {
                      Election = Election.connect(accounts[1]);
                      try {
                          await Election.Reset_Election("30");
                      } catch (e) {
                          if (e.toString().includes("Election_not_owner()")) {
                              assert(true);
                          } else {
                              console.error(e);
                              assert(false);
                          }
                      }
                  });
                  it("Works as intended !", async () => {
                      const ElectionStartBeforeReset =
                          await Election.get_electionStart();
                      const ElectionDurationBeforeReset =
                          await Election.get_electionDuration();
                      await Election.selfElect();
                      Election = Election.connect(accounts[1]);
                      await Election.selfElect();
                      for (let i = 0; i < 5; i++) {
                          Election = Election.connect(accounts[i + 2]);
                          Election.vote(accounts[0].address);
                          Election = Election.connect(accounts[i + 2 + 5]);
                          Election.vote(accounts[1].address);
                      }
                      await network.provider.send("evm_increaseTime", [
                          networkConfig[CHAINID]["interval"] + 1,
                      ]);
                      await network.provider.send("evm_mine", []);
                      Election = Election.connect(accounts[0]);

                      const tx = await Election.performUpkeep("0x");
                      const tr = await tx.wait("1");
                      await vrfV2Mock.fulfillRandomWords(
                          tr.events[1].args.requestId,
                          Election.address
                      );
                      await Election.Reset_Election("100");
                      const ElectionStartAfterReset =
                          await Election.get_electionStart();
                      const ElectionStateAfterReset =
                          await Election.get_electionState();
                      const ElectionDurationAfterReset =
                          await Election.get_electionDuration();
                      assert(
                          ElectionStartAfterReset.toString() >
                              ElectionStartBeforeReset.add(
                                  ElectionDurationBeforeReset
                              ).toString() &&
                              ElectionStateAfterReset.toString() == "0" &&
                              ElectionDurationAfterReset.toString() == "100"
                      );
                  });
              });
          });
      });

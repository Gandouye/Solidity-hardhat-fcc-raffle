const { assert, expect } = require("chai")
require("@nomicfoundation/hardhat-chai-matchers")
const { network, deployments, ethers, waffle } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { toBigInt } = require("ethers")
const { parseUnits, BigNumber, formatEther } = require("ethers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, raffleContract, vrfCoordinatorV2Mock, raffleEntranceFee, interval, player // , deployer

          beforeEach(async () => {
              accounts = await ethers.getSigners() // could also do with getNamedAccounts
              //deployer = (await getNamedAccounts()).deployer //
              deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["mocks", "raffle"]) // Deploys modules with the tags "mocks" and "raffle"
              const VRFCoordinatorV2MockAtAddress = (await deployments.get("VRFCoordinatorV2Mock"))
                  .address
              vrfCoordinatorV2Mock = await ethers.getContractAt(
                  "VRFCoordinatorV2Mock",
                  VRFCoordinatorV2MockAtAddress,
              ) // Returns a new connection to the VRFCoordinatorV2Mock contract
              const raffleAtAddress = (await deployments.get("Raffle")).address
              raffleContract = await ethers.getContractAt("Raffle", raffleAtAddress) // Returns a new connection to the Raffle contract
              raffle = raffleContract.connect(player) // Returns a new instance of the Raffle contract connected to player
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", function () {
              it("initializes the raffle correctly", async () => {
                  // Ideally, we'd separate these out so that only 1 assert per "it" block
                  // And ideally, we'd make this check everything
                  const raffleState = (await raffle.getRaffleState()).toString()
                  // Comparisons for Raffle initialization:
                  assert.equal(raffleState, "0")
                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId]["keepersUpdateInterval"],
                  )
              })
          })

          describe("enterRaffle", function () {
              it("reverts when you don't pay enough", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered",
                      // is reverted when not paid enough or raffle is not open
                  )
              })
              it("records player when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const contractPlayer = await raffle.getPlayer(0)
                  assert.equal(player.address, contractPlayer)
              })
              it("emits event on enter", async () => {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      // emits RaffleEnter event if entered to index player(s) address
                      raffle,
                      "RaffleEnter",
                  )
              })
              it("doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                  //We have the provider increase the time manualy
                  await network.provider.send("evm_increaseTime", [Number(interval) + 5])
                  //await network.provider.request({ method: "evm_mine", params: [] })
                  await network.provider.send("evm_mine", [])
                  // we pretend to be a keeper for a second
                  const zeroBytes = new Uint8Array()
                  await raffle.performUpkeep(zeroBytes) // changes the state to calculating for our comparison below
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
              })
          })
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 5])
                  //await network.provider.request({ method: "evm_mine", params: [] })
                  await network.provider.send("evm_mine", [])
                  //CallStatic evaluate if the execution would do well
                  const zeroBytes = new Uint8Array()
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(zeroBytes) // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded)
              })
              it("returns false if raffle isn't open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 3])
                  //await network.provider.request({ method: "evm_mine", params: [] })
                  await network.provider.send("evm_mine", [])
                  const zeroBytes = new Uint8Array()
                  await raffle.performUpkeep(zeroBytes) // changes the state to calculating
                  const raffleState = await raffle.getRaffleState() // stores the new state
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(zeroBytes) // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
              })
              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) - 5]) // use a higher number here if this test fails
                  //await network.provider.request({ method: "evm_mine", params: [] })
                  await network.provider.send("evm_mine", [])
                  const zeroBytes = new Uint8Array()
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(zeroBytes) // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  //await network.provider.request({ method: "evm_mine", params: [] })
                  await network.provider.send("evm_mine", [])
                  const zeroBytes = new Uint8Array()
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(zeroBytes) // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", function () {
              it("can only run if checkupkeep is true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  //await network.provider.request({ method: "evm_mine", params: [] })
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep("0x")
                  assert(tx)
              })
              it("reverts if checkup is false", async () => {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle_UpKeepNotNeeded",
                  )
              })
              it("updates the raffle state and emits a requestId", async () => {
                  // Too many asserts in this test!
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  //await network.provider.request({ method: "evm_mine", params: [] })
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep("0x") // emits requestId
                  const txReceipt = await txResponse.wait(1) // waits 1 block
                  const raffleState = await raffle.getRaffleState() // updates state
                  //const requestId = txReceipt.events[1].args.requestId
                  const requestId = txReceipt.logs[1].args.requestId
                  assert(Number(requestId) > 0)
                  assert(raffleState == 1) // 0 = open, 1 = calculating
              })
          })
          describe("fulfillRandomWords", function () {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 2])
                  //await network.provider.request({ method: "evm_mine", params: [] })
                  await network.provider.send("evm_mine", [])
              })
              it("can only be called after performupkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target), // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target), // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request")
              })

              // This test is too big...
              // This test simulates users entering the raffle and wraps the entire functionality of the raffle
              // inside a promise that will resolve if everything is successful.
              // An event listener for the WinnerPicked is set up
              // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
              // All the assertions are done once the WinnerPicked event is fired
              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3 // to test
                  const startingIndex = 2
                  let startingBalance, gasCost
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      // i = 2; i < 5; i=i+1
                      raffle = raffleContract.connect(accounts[i]) // Returns a new instance of the Raffle contract connected to player
                      if (i == 2) {
                          const transactionResponse = await raffle.enterRaffle({
                              value: raffleEntranceFee,
                          })
                          const transactionReceipt = await transactionResponse.wait(1)
                          const { gasUsed, gasPrice, fee } = transactionReceipt
                          gasCost = formatEther(fee) //Cost of the transaction ion ETH
                          console.log("gasCost = " + gasCost)
                          console.log("gasUsed = " + gasUsed) // the total number of gas used
                          console.log("gasPrice = " + gasPrice) //The price of a gas unit used... in wei
                          console.log("fee = " + fee) //The total cost of the transaction
                      } else {
                          await raffle.enterRaffle({ value: raffleEntranceFee })
                      }
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp() // stores starting timestamp (before we fire our event)

                  // This will be more important for our staging tests...
                  await new Promise(async (resolve, reject) => {
                      setTimeout(resolve, 5000)
                      raffle.on("WinnerPicked", async () => {
                          // event listener for WinnerPicked
                          console.log("WinnerPicked event fired!")
                          // assert throws an error if it fails, so we need to wrap
                          // it in a try/catch so that the promise returns event
                          // if it fails.
                          try {
                              // Now lets get the ending values...
                              const recentWinner = await raffle.getRecentWinner()
                              console.log("Recent winner:" + recentWinner.toString())
                              const raffleState = await raffle.getRaffleState()
                              const provider = ethers.getDefaultProvider()
                              const winnerBalance = await provider.getBalance(accounts[2].address) //accounts[2].getBalance()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()
                              await expect(raffle.getPlayer(0)).to.be.reverted
                              // Comparisons to check if our ending values are correct:
                              console.log("Account 2: " + accounts[2].address)
                              assert.equal(recentWinner.toString(), accounts[2].address)
                              assert.equal(raffleState, 0)

                              const ETHValueOfraffleEntranceFee = formatEther(raffleEntranceFee)
                              console.log(
                                  "ETHValueOfraffleEntranceFee = " + ETHValueOfraffleEntranceFee,
                              )
                              const balance1 = Number(winnerBalance)
                              // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                              const balance2 =
                                  Number(startingBalance) +
                                  ETHValueOfraffleEntranceFee * Number(additionalEntrances) +
                                  ETHValueOfraffleEntranceFee
                              console.log("Winner balance = " + balance1)
                              console.log("startingBalance = " + startingBalance)
                              console.log("additionalEntrances = " + additionalEntrances)
                              console.log("Balance 2 = " + balance2)
                              assert.equal(balance1, balance2)
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve() // if try passes, resolves the promise
                          } catch (e) {
                              reject(e) // if try fails, rejects the promise
                          }
                      })

                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      try {
                          const tx = await raffle.performUpkeep(new Uint8Array())
                          const txReceipt = await tx.wait(1)
                          //console.log("account 2 " + accounts[2])
                          const provider = ethers.getDefaultProvider()
                          startingBalance = await provider.getBalance(accounts[2].address) //accounts[2].getBalance()
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              txReceipt.logs[1].args.requestId,
                              raffle.target,
                          )
                      } catch (e) {
                          reject(e)
                      }
                  })
              })
          })
      })

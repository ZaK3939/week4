import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers,Contract,utils } from "ethers"
import Head from "next/head"
import React ,{ useEffect, useState } from "react"
import styles from "../styles/Home.module.css"
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import * as yup from 'yup';
import { yupResolver } from "@hookform/resolvers/yup";
import { SubmitHandler, useForm } from 'react-hook-form';
import Button from "@material-ui/core/Button"
import { TextField } from "@material-ui/core"

const schema = yup.object().shape({
    name: yup.string().required(),
    age: yup.number().max(100, 'Younger than age 100').min(0, 'age 0 is incorrect').required('Input your age!'),
    address: yup.string().optional(),
    });
type Inputs = yup.InferType<typeof schema>;


export default function Home() {
    const [logs, setLogs] = useState("Connect your wallet and greet!")
    const [greeting, setGreeting] = useState("No greet")
    const { register, handleSubmit, formState: { errors },reset } = useForm<Inputs>(
    { resolver: yupResolver(schema) }
    );
const onSubmit: SubmitHandler<Inputs> = data => { console.log(data); reset(); };
    async function onEvent() {
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi)
        const provider = new providers.JsonRpcProvider("http://localhost:8545")
        const contractOwner = contract.connect(provider.getSigner())
        contractOwner.on("NewGreeting", (greeting) => {
          setGreeting(utils.parseBytes32String(greeting));
        });
    }
    useEffect(() => {
    onEvent();
    }, [])

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()
            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    
    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
               
                <div className={styles.description}>Greeting: {greeting} ...</div>

                <TextField
                required
                label="name"
                error={'name' in errors}
                helperText={errors.name?.message}
                {...register("name") }
                />
                <TextField label="address"
                error={'address' in errors}
                helperText={errors.address?.message}
                {...register('address')}  />
                <TextField
                required
                label="age"
                type="number"
                error={'age' in errors}
                helperText={errors.age?.message}
                {...register('age')}
                />
                <Button
                color="primary"
                variant="contained"
                size="large"
                onClick={handleSubmit(onSubmit)}
                >
                save
                </Button>
            </main>
        </div>
    )
}



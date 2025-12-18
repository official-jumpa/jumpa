export const jumpaFactoryProxyAbi = {
  _format: "hh3-artifact-1",
  contractName: "JumpaFactoryProxy",
  contractAddress: "0x07E1a9A5271834992e3BF2666770F95e34085791", //sepolia
  sourceName: "contracts/JumpaFactoryProxy.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "implementation",
          type: "address",
        },
        {
          internalType: "bytes",
          name: "_data",
          type: "bytes",
        },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "target",
          type: "address",
        },
      ],
      name: "AddressEmptyCode",
      type: "error",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "implementation",
          type: "address",
        },
      ],
      name: "ERC1967InvalidImplementation",
      type: "error",
    },
    {
      inputs: [],
      name: "ERC1967NonPayable",
      type: "error",
    },
    {
      inputs: [],
      name: "FailedCall",
      type: "error",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "implementation",
          type: "address",
        },
      ],
      name: "Upgraded",
      type: "event",
    },
    {
      stateMutability: "payable",
      type: "fallback",
    },
  ],
};

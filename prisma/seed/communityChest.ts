import "dotenv/config";
import { prisma } from "../../app/lib/prisma";

async function main() {
  const cards = [
    {
      title: "Bank Error in Your Favor",
      description: "The bank has made an error in your favor. Collect ₹200.",
      amount: 200,
      action: "RECEIVE_MONEY" as const,
    },
    {
      title: "Doctor's Fees",
      description: "Pay doctor’s fees of ₹50.",
      amount: 50,
      action: "PAY_MONEY" as const,
    },
    {
      title: "From Sale of Stock",
      description: "You receive ₹50 from the sale of stock.",
      amount: 50,
      action: "RECEIVE_MONEY" as const,
    },
    {
      title: "Get Out of Jail Free",
      description: "This card may be kept until needed or sold/traded.",
      amount: 0,
      action: "GET_OUT_OF_JAIL" as const,
    },
    {
      title: "Go to Jail",
      description:
        "Go directly to Jail. Do not pass GO. Do not collect ₹200.",
      amount: 0,
      action: "MOVE_TO_JAIL" as const,
    },
    {
      title: "Holiday Fund Matures",
      description: "Receive ₹100.",
      amount: 100,
      action: "RECEIVE_MONEY" as const,
    },
    {
      title: "Income Tax Refund",
      description: "Collect ₹20.",
      amount: 20,
      action: "RECEIVE_MONEY" as const,
    },
    {
      title: "It Is Your Birthday",
      description: "Collect ₹10 from every other player.",
      amount: 10,
      action: "RECEIVE_MONEY" as const,
    },
    {
      title: "Life Insurance Matures",
      description: "Collect ₹100.",
      amount: 100,
      action: "RECEIVE_MONEY" as const,
    },
    {
      title: "Pay Hospital Fees",
      description: "Pay hospital fees of ₹100.",
      amount: 100,
      action: "PAY_MONEY" as const,
    },
    {
      title: "Pay School Fees",
      description: "Pay school fees of ₹50.",
      amount: 50,
      action: "PAY_MONEY" as const,
    },
    {
      title: "Receive Consultancy Fee",
      description: "You receive ₹25 consultancy fees.",
      amount: 25,
      action: "RECEIVE_MONEY" as const,
    },
    {
      title: "Advance to GO",
      description: "Advance directly to GO and collect ₹200.",
      amount: 200,
      action: "MOVE_TO_GO" as const,
    },
  ];

  for (const card of cards) {
    await prisma.communityChestCard.create({
      data: card,
    });
  }

  console.log(`Created ${cards.length} Community Chest cards.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
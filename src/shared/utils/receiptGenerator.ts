import { createCanvas, loadImage } from "canvas";
import path from "path";

export interface TransactionReceiptData {
  amount: string;
  amountInCrypto: string;
  currency: string;
  timestamp: Date;
  network: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  transactionHash?: string;
}

export async function generateTransactionReceipt(
  data: TransactionReceiptData
): Promise<Buffer> {
  // Create canvas at 2x resolution for higher quality
  const scale = 2;
  const width = 725 * scale;
  const height = 1150 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Enable high quality rendering
  ctx.imageSmoothingEnabled = true;

  // Background - white/light gray
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, width, height);

  // Top padding
  let yPos = 60 * scale;

  // Logo and title section - centered horizontally, side by side
  try {
    const logoPath = path.join(process.cwd(), "src", "images", "logo.png");
    const logo = await loadImage(logoPath);
    const logoSize = 45 * scale;

    // Measure text width
    ctx.font = `bold ${38 * scale}px Arial`;
    const textWidth = ctx.measureText("JumpaBot").width;
    const totalWidth = logoSize + 20 * scale + textWidth; // logo + spacing + text

    // Calculate starting X position to center everything
    const startX = (width - totalWidth) / 2;
    const logoX = startX;
    const logoY = yPos;

    // Draw circular logo
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    ctx.restore();

    // JumpaBot text - positioned to the right of logo, vertically centered
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `bold ${38 * scale}px Arial`;
    ctx.textAlign = "left";
    ctx.fillText("JumpaBot", logoX + logoSize + 20 * scale, logoY + logoSize / 2 + 12 * scale);
  } catch (error) {
    console.error("Error loading logo:", error);
    // Fallback: just show text centered
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `bold ${38 * scale}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("JumpaBot", width / 2, yPos + 32 * scale);
  }

  yPos += 100 * scale;

  // Success card section
  const cardMargin = 35 * scale;
  const cardWidth = width - (cardMargin * 2);
  const cardHeight = 320 * scale;
  const cardRadius = 25 * scale;

  // Draw rounded rectangle for success card
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cardMargin + cardRadius, yPos);
  ctx.lineTo(cardMargin + cardWidth - cardRadius, yPos);
  ctx.quadraticCurveTo(cardMargin + cardWidth, yPos, cardMargin + cardWidth, yPos + cardRadius);
  ctx.lineTo(cardMargin + cardWidth, yPos + cardHeight - cardRadius);
  ctx.quadraticCurveTo(cardMargin + cardWidth, yPos + cardHeight, cardMargin + cardWidth - cardRadius, yPos + cardHeight);
  ctx.lineTo(cardMargin + cardRadius, yPos + cardHeight);
  ctx.quadraticCurveTo(cardMargin, yPos + cardHeight, cardMargin, yPos + cardHeight - cardRadius);
  ctx.lineTo(cardMargin, yPos + cardRadius);
  ctx.quadraticCurveTo(cardMargin, yPos, cardMargin + cardRadius, yPos);
  ctx.closePath();

  // Purple gradient background
  const purpleGradient = ctx.createLinearGradient(cardMargin, yPos, cardMargin + cardWidth, yPos + cardHeight);
  purpleGradient.addColorStop(0, "#8b5cf6");
  purpleGradient.addColorStop(1, "#7c3aed");
  ctx.fillStyle = purpleGradient;
  ctx.fill();
  ctx.restore();

  // Checkmark circle
  const checkY = yPos + 110 * scale;
  ctx.fillStyle = "#2d1b4e";
  ctx.beginPath();
  ctx.arc(width / 2, checkY, 70 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Draw checkmark
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(width / 2 - 30 * scale, checkY);
  ctx.lineTo(width / 2 - 10 * scale, checkY + 20 * scale);
  ctx.lineTo(width / 2 + 30 * scale, checkY - 25 * scale);
  ctx.stroke();

  // Amount with strikethrough on Naira symbol (centered)
  const amountY = yPos + 250 * scale;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${70 * scale}px Arial`;
  ctx.textAlign = "center";

  // Measure text widths
  const nairaWidth = ctx.measureText("₦").width;
  const amountWidth = ctx.measureText(data.amount).width;
  const totalWidth = nairaWidth + amountWidth;

  // Calculate starting X to center everything
  const amountStartX = (width - totalWidth) / 2;
  const amountX = amountStartX;

  // Draw strikethrough Naira symbol
  ctx.textAlign = "left";
  ctx.fillText("₦", amountX, amountY);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6 * scale;
  ctx.beginPath();
  ctx.moveTo(amountX + 5 * scale, amountY - 22 * scale);
  ctx.lineTo(amountX + nairaWidth - 5 * scale, amountY - 22 * scale);
  ctx.stroke();

  // Draw amount
  ctx.fillText(data.amount, amountX + nairaWidth, amountY);

  yPos += cardHeight + 30 * scale;

  // Helper function to draw rounded card
  const drawRoundedCard = (y: number, cardH: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cardMargin + cardRadius, y);
    ctx.lineTo(cardMargin + cardWidth - cardRadius, y);
    ctx.quadraticCurveTo(cardMargin + cardWidth, y, cardMargin + cardWidth, y + cardRadius);
    ctx.lineTo(cardMargin + cardWidth, y + cardH - cardRadius);
    ctx.quadraticCurveTo(cardMargin + cardWidth, y + cardH, cardMargin + cardWidth - cardRadius, y + cardH);
    ctx.lineTo(cardMargin + cardRadius, y + cardH);
    ctx.quadraticCurveTo(cardMargin, y + cardH, cardMargin, y + cardH - cardRadius);
    ctx.lineTo(cardMargin, y + cardRadius);
    ctx.quadraticCurveTo(cardMargin, y, cardMargin + cardRadius, y);
    ctx.closePath();
    ctx.fillStyle = "#2d1b4e";
    ctx.fill();
    ctx.restore();
  };

  // Helper function to draw detail row
  const drawDetailRow = (label: string, value: string, y: number, leftPad: number) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `${18 * scale}px Arial`;
    ctx.fillText(label + ":", leftPad, y);

    ctx.textAlign = "right";
    ctx.font = `${18 * scale}px Arial`;
    ctx.fillText(value, width - cardMargin - 60 * scale, y);
  };

  // Recipient Account Details Card
  const accountCardHeight = 200 * scale;
  drawRoundedCard(yPos, accountCardHeight);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${22 * scale}px Arial`;
  ctx.fillText("RECIPIENT ACCOUNT DETAILS", width / 2, yPos + 40 * scale);

  const accountDetailsY = yPos + 80 * scale;
  const detailPadding = cardMargin + 60 * scale;

  drawDetailRow("Bank Name", data.bankName || "N/A", accountDetailsY, detailPadding);
  drawDetailRow("Account Name", data.accountName || "N/A", accountDetailsY + 40 * scale, detailPadding);
  drawDetailRow("Account Number", data.accountNumber || "N/A", accountDetailsY + 80 * scale, detailPadding);

  yPos += accountCardHeight + 25 * scale;

  // Transaction Details Card
  const txCardHeight = 260 * scale;
  drawRoundedCard(yPos, txCardHeight);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${22 * scale}px Arial`;
  ctx.fillText("TRANSACTION DETAILS", width / 2, yPos + 40 * scale);

  const txDetailsY = yPos + 80 * scale;

  drawDetailRow("Network", data.network, txDetailsY, detailPadding);
  drawDetailRow(
    "Date",
    data.timestamp.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }),
    txDetailsY + 40 * scale,
    detailPadding
  );
  drawDetailRow(
    "Amount in " + data.currency,
    `${data.amountInCrypto} ${data.currency}`,
    txDetailsY + 80 * scale,
    detailPadding
  );

  // Always show transaction hash
  const displayHash = data.transactionHash
    ? (data.transactionHash.length > 15
        ? data.transactionHash.substring(0, 8) + "..." + data.transactionHash.substring(data.transactionHash.length - 5)
        : data.transactionHash)
    : "N/A";

  drawDetailRow("Tnx Hash", displayHash, txDetailsY + 120 * scale, detailPadding);

  yPos += txCardHeight + 50 * scale;

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";
  ctx.font = `bold ${18 * scale}px Arial`;
  ctx.fillText("Powered by  |  ", width / 2 - 40 * scale, yPos);

  // Draw small logo next to "Powered by"
  try {
    const logoPath = path.join(process.cwd(), "src", "images", "logo.png");
    const logo = await loadImage(logoPath);
    const footerLogoSize = 24 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2 + 42 * scale, yPos - 8 * scale, footerLogoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, width / 2 + 42 * scale - footerLogoSize / 2, yPos - 8 * scale - footerLogoSize / 2, footerLogoSize, footerLogoSize);
    ctx.restore();

    ctx.fillStyle = "#9ca3af";
    ctx.font = `bold ${18 * scale}px Arial`;
    ctx.fillText("JumpaBot", width / 2 + 120 * scale, yPos);
  } catch (error) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = `bold ${18 * scale}px Arial`;
    ctx.fillText("JumpaBot", width / 2 + 60 * scale, yPos);
  }

  // Convert to buffer
  return canvas.toBuffer("image/png");
}

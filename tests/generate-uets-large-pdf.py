from pathlib import Path
import random

from PIL import Image
from reportlab import rl_config
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tests" / "fixtures" / "uets-large-95mb.pdf"
FONT = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")

IMAGE_WIDTH = 10_000
IMAGE_HEIGHT = 9_450


def build_pdf() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    rl_config.useA85 = 0
    pdfmetrics.registerFont(TTFont("FixtureArial", str(FONT)))
    pdfmetrics.registerFont(TTFont("FixtureArialBold", str(FONT_BOLD)))

    document = canvas.Canvas(
        str(OUTPUT),
        pagesize=A4,
        pageCompression=1,
        invariant=1,
    )
    width, height = A4

    document.setTitle("UETS Büyük PDF Stres Testi")
    document.setAuthor("AL METHER Legal Local Test Fixture")

    document.setFont("FixtureArial", 8)
    document.drawCentredString(width / 2, height - 38, "PTT UETS ELEKTRONİK TEBLİGAT")
    document.setFont("FixtureArialBold", 12)
    document.drawCentredString(width / 2, height - 58, "T.C.")
    document.drawCentredString(width / 2, height - 78, "İZMİR")
    document.setFont("FixtureArialBold", 15)
    document.drawCentredString(
        width / 2,
        height - 102,
        "23. ASLİYE HUKUK MAHKEMESİ",
    )

    document.setStrokeColorRGB(0.63, 0.48, 0.18)
    document.line(54, height - 118, width - 54, height - 118)

    lines = [
        ("Mahkeme:", "İzmir 23. Asliye Hukuk Mahkemesi"),
        ("Dosya No:", "2026/52 Esas"),
        ("Karar No:", "2026/255"),
        ("Barkod No:", "5003003284830"),
        ("Davacı:", "OZAN YARALI"),
        ("Vekili:", "Av. RAHMAN AKINCI"),
        ("Taraflar:", "OZAN YARALI / Av. RAHMAN AKINCI"),
        ("Konu:", "İstinaf avansı"),
    ]

    y = height - 158
    for label, value in lines:
        document.setFont("FixtureArialBold", 10.5)
        document.drawString(62, y, label)
        document.setFont("FixtureArial", 10.5)
        document.drawString(145, y, value)
        y -= 24

    document.setFont("FixtureArial", 11)
    notice_lines = [
        "Mahkeme kararının istinaf edilmiş olması nedeniyle",
        "1.500,00 TL istinaf avansının iki haftalık süre içerisinde",
        "mahkememiz dosyasına yatırılması ihtar olunur.",
    ]
    y -= 14
    for line in notice_lines:
        document.drawString(62, y, line)
        y -= 21

    document.setFont("FixtureArialBold", 10.5)
    document.drawString(62, y - 18, "Kaynak belge:")
    document.setFont("FixtureArial", 10.5)
    document.drawString(145, y - 18, "uets-large-95mb.pdf")

    document.setFont("FixtureArial", 8)
    document.setFillColorRGB(0.35, 0.35, 0.35)
    document.drawString(
        62,
        42,
        "Yerel parser ve UETS analiz stres testi için sentetik hukuk belgesidir.",
    )
    document.showPage()

    # Deterministic, poorly-compressible grayscale pixels form a real PDF
    # image XObject. The target size comes from actual image data, not bytes
    # appended after the PDF EOF marker.
    pixels = random.Random(20260813).randbytes(
        IMAGE_WIDTH * IMAGE_HEIGHT
    )
    stress_image = Image.frombytes(
        "L",
        (IMAGE_WIDTH, IMAGE_HEIGHT),
        pixels,
    )

    document.drawImage(
        ImageReader(stress_image),
        42,
        68,
        width=width - 84,
        height=height - 136,
        preserveAspectRatio=False,
        mask=None,
    )

    document.setFillColorRGB(1, 1, 1)
    document.rect(42, height - 102, width - 84, 54, stroke=0, fill=1)
    document.setFillColorRGB(0.08, 0.08, 0.08)
    document.setFont("FixtureArialBold", 11)
    document.drawString(54, height - 72, "UETS PDF YAPISAL STRES GÖRSELİ")
    document.setFont("FixtureArial", 9)
    document.drawString(
        54,
        height - 89,
        "Kaynak belge: uets-large-95mb.pdf - aranabilir metin katmanı aktiftir.",
    )

    document.save()

    size = OUTPUT.stat().st_size
    if not 94_000_000 <= size <= 96_000_000:
        raise RuntimeError(
            f"Fixture target dışında: {size} bytes"
        )

    print(f"{OUTPUT}|{size}")


if __name__ == "__main__":
    build_pdf()

import type { Metadata } from "next";
import Image from "next/image";
import {
  Check,
  Download,
  Monitor,
  ShieldCheck,
} from "lucide-react";

import styles from "./page.module.css";

const INSTALLER_NAME = "AL-METHER-Legal-Setup.exe";
const INSTALLER_SIZE = "10,5 MB";
const INSTALLER_SHA256 =
  "B39BA787BD3EDDA0B1F123E10E332CFF63A20CCA2428DA614E0EEBC2185CAD5D";

// Gerçek public dosya doğrulandıktan sonra bu değer doldurulur.
const DOWNLOAD_URL: string | null = null;

export const metadata: Metadata = {
  title: "Windows için İndir | AL METHER Legal",
  description:
    "AL METHER Legal resmi Windows 10/11 kurulum dosyasını indirin.",
};

export default function DownloadPage() {
  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />

      <header className={styles.header}>
        <a className={styles.brand} href="/download" aria-label="AL METHER Legal">
          <Image
            className={styles.brandIcon}
            src="/brand/legal-icon-dark.png"
            alt=""
            width={42}
            height={42}
            priority
          />
          <span>
            <strong>AL METHER</strong>
            <small>LEGAL</small>
          </span>
        </a>

        <div className={styles.officialBadge}>
          <ShieldCheck size={15} aria-hidden="true" />
          Resmî indirme
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.eyebrow}>
            <span className={styles.windowsMark} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            Windows masaüstü uygulaması
          </div>

          <h1>
            Hukuk iş akışınız,
            <span> artık masaüstünde.</span>
          </h1>

          <p className={styles.lead}>
            AL METHER Legal&apos;in Windows uygulamasını indirin. Dosyalarınıza,
            takviminize ve hukuk çalışma alanınıza doğrudan masaüstünüzden
            erişin.
          </p>

          <div className={styles.actions}>
            {DOWNLOAD_URL ? (
              <a className={styles.downloadButton} href={DOWNLOAD_URL}>
                <Download size={19} aria-hidden="true" />
                <span>
                  <strong>Windows için İndir</strong>
                  <small>Windows 10/11 · {INSTALLER_SIZE}</small>
                </span>
              </a>
            ) : (
              <span
                className={`${styles.downloadButton} ${styles.downloadDisabled}`}
                aria-disabled="true"
              >
                <Download size={19} aria-hidden="true" />
                <span>
                  <strong>Windows için İndir</strong>
                  <small>Yayın hazırlanıyor</small>
                </span>
              </span>
            )}

            <div className={styles.compatibility}>
              <Check size={14} aria-hidden="true" />
              Windows 10 ve Windows 11 ile uyumlu
            </div>
          </div>
        </div>

        <aside className={styles.installerCard} aria-label="Kurulum dosyası bilgileri">
          <div className={styles.cardTopline}>
            <span>WINDOWS INSTALLER</span>
            <span>v1.0.0</span>
          </div>

          <div className={styles.appIdentity}>
            <div className={styles.appIcon}>
              <Image
                src="/brand/legal-app-icon-dark.png"
                alt="AL METHER Legal uygulama ikonu"
                width={76}
                height={76}
              />
            </div>
            <div>
              <p>AL METHER Legal</p>
              <span>Windows 10/11</span>
            </div>
          </div>

          <div className={styles.fileRow}>
            <Monitor size={18} aria-hidden="true" />
            <div>
              <span>Kurulum dosyası</span>
              <strong>{INSTALLER_NAME}</strong>
            </div>
            <small>{INSTALLER_SIZE}</small>
          </div>

          <div className={styles.checksum}>
            <div>
              <ShieldCheck size={16} aria-hidden="true" />
              <span>SHA-256 doğrulama değeri</span>
            </div>
            <code>{INSTALLER_SHA256}</code>
          </div>

          <p className={styles.securityNote}>
            Dosya bütünlüğünü doğrulamak için indirme sonrası SHA-256 değerini
            karşılaştırabilirsiniz.
          </p>
        </aside>
      </section>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} AL METHER</span>
        <span>Resmî Windows dağıtımı</span>
      </footer>
    </main>
  );
}

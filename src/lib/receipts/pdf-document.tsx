import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer"
import { formatAmount, formatChf, formatDateShort } from "@/lib/receipts/format"
import type { ReceiptPdfData } from "@/lib/receipts/types"

/**
 * Server-side receipt PDF (ADR-015 E6, concept 4.4). Node runtime, standard
 * Helvetica font (no external font fetches), table-based layout. Rendered from
 * an immutable snapshot, so the output is deterministic and reproducible.
 *
 * NOTE: This is intentionally NOT a `"use client"` module — it is only ever
 * imported by the PDF service, which runs on the Node server runtime.
 */

const COLORS = {
  text: "#1f2937",
  muted: "#6b7280",
  line: "#d1d5db",
  headerBg: "#f3f4f6",
  danger: "#b91c1c",
  dangerBg: "#fef2f2",
} as const

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.text,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  logo: {
    maxWidth: 160,
    maxHeight: 60,
    objectFit: "contain",
  },
  orgBlock: {
    textAlign: "right",
    marginLeft: "auto",
  },
  orgName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  orgLine: {
    fontSize: 9,
    color: COLORS.muted,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    marginVertical: 12,
  },
  recipientLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  recipientName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 24,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
  },
  metaValue: {
    fontSize: 9,
    color: COLORS.muted,
  },
  period: {
    fontSize: 10,
    marginBottom: 16,
  },
  cancelledBanner: {
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 3,
    padding: 8,
    marginBottom: 14,
  },
  cancelledTitle: {
    fontFamily: "Helvetica-Bold",
    color: COLORS.danger,
    fontSize: 11,
  },
  cancelledReason: {
    color: COLORS.danger,
    fontSize: 9,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  cellDate: { width: "16%" },
  cellDesc: { width: "50%" },
  cellKm: { width: "16%", textAlign: "right" },
  cellAmount: { width: "18%", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  totalLabel: {
    width: "66%",
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    paddingRight: 8,
  },
  totalValue: {
    width: "34%",
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  paymentNote: {
    marginTop: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.muted,
  },
})

function orgAddressLines(data: ReceiptPdfData): string[] {
  const { org } = data
  const lines: string[] = []
  if (org.street) lines.push(org.street)
  const cityLine = [org.postalCode, org.city].filter(Boolean).join(" ").trim()
  if (cityLine) lines.push(cityLine)
  const contact = [org.phone, org.email].filter(Boolean).join(" · ")
  if (contact) lines.push(contact)
  return lines
}

/**
 * Build the receipt PDF element. Returns the root `<Document>` element directly
 * (not a wrapper component) so its type is `ReactElement<DocumentProps>`, which
 * `renderToBuffer` accepts without a cast.
 */
export function ReceiptDocument({ data }: { data: ReceiptPdfData }): React.ReactElement {
  const recipientAddressLines = data.recipientAddress.split("\n").filter(Boolean)
  const isCancelled = data.status === "cancelled"

  return (
    <Document
      title={`Quittung ${data.receiptNumber}`}
      author={data.org.name}
      creator={data.org.name}
      producer="Dispo"
    >
      <Page size="A4" style={styles.page}>
        {/* Letterhead */}
        <View style={styles.header}>
          {data.logoDataUri ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt
            <Image style={styles.logo} src={data.logoDataUri} />
          ) : (
            <View />
          )}
          <View style={styles.orgBlock}>
            <Text style={styles.orgName}>{data.org.name}</Text>
            {orgAddressLines(data).map((line, i) => (
              <Text key={i} style={styles.orgLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Recipient */}
        <View>
          <Text style={styles.recipientLabel}>Empfänger</Text>
          <Text style={styles.recipientName}>{data.recipientName}</Text>
          {recipientAddressLines.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </View>

        {/* Title + issue date */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Quittung {data.receiptNumber}</Text>
          <Text style={styles.metaValue}>
            Ausgestellt am {formatDateShort(data.issuedAt.slice(0, 10))}
          </Text>
        </View>
        <Text style={styles.period}>
          Zeitraum: {formatDateShort(data.periodFrom)} – {formatDateShort(data.periodTo)}
        </Text>

        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledTitle}>STORNIERT</Text>
            {data.cancelledReason ? (
              <Text style={styles.cancelledReason}>Grund: {data.cancelledReason}</Text>
            ) : null}
          </View>
        )}

        {/* Positions table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.cellDate]}>Datum</Text>
          <Text style={[styles.th, styles.cellDesc]}>Fahrt</Text>
          <Text style={[styles.th, styles.cellKm]}>km</Text>
          <Text style={[styles.th, styles.cellAmount]}>Betrag CHF</Text>
        </View>

        {data.items.map((item, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <Text style={styles.cellDate}>{formatDateShort(item.rideDate)}</Text>
            <Text style={styles.cellDesc}>{item.description}</Text>
            <Text style={styles.cellKm}>
              {item.distanceKm != null ? item.distanceKm.toFixed(1) : "–"}
            </Text>
            <Text style={styles.cellAmount}>{formatAmount(item.amount)}</Text>
          </View>
        ))}

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {formatChf(data.totalAmount, data.currency)}
          </Text>
        </View>

        {/* Payment confirmation (no VAT block — concept 4.4) */}
        <Text style={styles.paymentNote}>
          Betrag dankend erhalten (Barzahlung/Twint)
        </Text>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Ausgestellt durch: {data.issuedByName}</Text>
          <Text>{data.org.name}</Text>
        </View>
      </Page>
    </Document>
  )
}

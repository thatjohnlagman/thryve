"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Plus, Minus } from "lucide-react"
import Accordion from "@mui/material/Accordion"
import AccordionSummary from "@mui/material/AccordionSummary"
import AccordionDetails from "@mui/material/AccordionDetails"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Stack from "@mui/material/Stack"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import Box from "@mui/material/Box"
import Grid from "@mui/material/Grid"
import Paper from "@mui/material/Paper"
import { styled } from "@mui/material/styles"
import {
  Lightbulb,
  Target,
  TrendingUp,
  Users,
  DollarSign,
  Shield,
  BarChart3,
  FileText,
  AlertTriangle,
  CheckCircle,
  MapPin,
} from "lucide-react"

interface TrendDetailsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trendTitle: string
  trendSummary: string
  trendInterpretation: string
  trendCategory: string
  trendImpact: "High" | "Medium" | "Low"
  detailedResearch: {
    keyInsights?: {
      summary?: string
      interpretation?: string
    }
    marketValidation?: {
      targetMarketSize?: string
      adoptionRate?: string
      revenueOpportunity?: string
    }
    competitiveAnalysis?: {
      currentState?: string
      bpiPosition?: string
      marketWindow?: string
      competitors?: string[]
    }
    implementationDetails?: {
      technicalRequirements?: string
      developmentTime?: string
      investmentNeeded?: string
      riskFactors?: string[]
    }
    successMetrics?: {
      targetKPIs?: string[]
      pilotStrategy?: string
      roiTimeline?: string
    }
    supportingEvidence?: {
      caseStudies?: string[]
      localContext?: string
      regulatory?: string
    }
    businessModel: {
      revenueModel: string
      keyCustomers: string[]
      valuePropositions: string[]
      keyPartnerships: string[]
      bpiAlignment: string
      risks: string[]
      riskMitigation?: string[]
      customerSatisfactionIncrease?: string
      revenueIncrease?: string
      marketCoverageImprovement?: string
    }
    businessImpact?: {
      customerSatisfactionIncrease?: string
      revenueGrowthPotential?: string
      marketCoverageExpansion?: string
    }
  }
  sources?: string[]
}

// Styled components for enhanced visual hierarchy
const StyledAccordion = styled(Accordion)(({ theme }) => ({
  borderRadius: `${theme.spacing(2)} !important`,
  marginBottom: theme.spacing(2),
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid rgba(224, 0, 10, 0.08)",
  "&:before": {
    display: "none",
  },
  "&.Mui-expanded": {
    margin: `0 0 ${theme.spacing(2)}px 0`,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  },
}))

const StyledAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
  backgroundColor: "rgba(224, 0, 10, 0.02)",
  borderRadius: theme.spacing(2),
  minHeight: 64,
  cursor: "pointer",
  "&:hover": {
    backgroundColor: "rgba(224, 0, 10, 0.04)",
  },
  "&.Mui-expanded": {
    minHeight: 64,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  "& .MuiAccordionSummary-content": {
    margin: `${theme.spacing(2)}px 0`,
    "&.Mui-expanded": {
      margin: `${theme.spacing(2)}px 0`,
    },
  },
}))

const MetricsPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  backgroundColor: "rgba(224, 0, 10, 0.02)",
  border: "1px solid rgba(224, 0, 10, 0.08)",
  boxShadow: "0 2px 8px rgba(224, 0, 10, 0.06)",
}))

// Helper function to get a friendly name from URL
function getSourceName(url: string): string {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.replace("www.", "")

    const domainMap: Record<string, string> = {
      "inquirer.net": "Philippine Daily Inquirer",
      "businessworld.com.ph": "BusinessWorld",
      "businessworld-online.com": "BusinessWorld",
      "rappler.com": "Rappler",
      "news.abs-cbn.com": "ABS-CBN News",
      "gmanetwork.com": "GMA News",
      "philstar.com": "Philippine Star",
      "manilatimes.net": "Manila Times",
      "bsp.gov.ph": "Bangko Sentral ng Pilipinas",
      "bpi.com.ph": "BPI",
      "reuters.com": "Reuters",
      "bloomberg.com": "Bloomberg",
      "ft.com": "Financial Times",
      "wsj.com": "Wall Street Journal",
      "techcrunch.com": "TechCrunch",
      "forbes.com": "Forbes",
      "cnbc.com": "CNBC",
    }

    if (domainMap[domain]) {
      return domainMap[domain]
    }

    const parts = domain.split(".")
    if (parts.length >= 2) {
      const mainPart = parts[parts.length - 2]
      return mainPart.charAt(0).toUpperCase() + mainPart.slice(1)
    }

    return domain
  } catch {
    const match = url.match(/https?:\/\/(?:www\.)?([^/]+)/)
    if (match) {
      const domain = match[1]
      const parts = domain.split(".")
      if (parts.length >= 2) {
        const mainPart = parts[parts.length - 2]
        return mainPart.charAt(0).toUpperCase() + mainPart.slice(1)
      }
      return domain
    }
    return "External Source"
  }
}

// Helper function to get random sources for each section
function getRandomSources(sources: string[], count = 2): string[] {
  if (sources.length <= count) return sources
  const shuffled = [...sources].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

// Helper function to generate business impact insights
const generateBusinessImpactInsight = (
  type: "satisfaction" | "revenue" | "coverage",
  trendTitle: string,
  research: any,
) => {
  // Check if AI-generated business impact data exists from research
  if (research?.businessImpact) {
    switch (type) {
      case "satisfaction":
        return (
          research.businessImpact.customerSatisfactionIncrease ||
          "Customer satisfaction impact will be analyzed during deep research."
        )
      case "revenue":
        return (
          research.businessImpact.revenueGrowthPotential ||
          "Revenue growth potential will be calculated during deep research."
        )
      case "coverage":
        return (
          research.businessImpact.marketCoverageExpansion ||
          "Market coverage expansion will be assessed during deep research."
        )
    }
  }

  // Fallback if no AI-generated data available yet
  switch (type) {
    case "satisfaction":
      return "Customer satisfaction impact will be analyzed during deep research."
    case "revenue":
      return "Revenue growth potential will be calculated during deep research."
    case "coverage":
      return "Market coverage expansion will be assessed during deep research."
    default:
      return "Impact analysis will be generated during comprehensive research."
  }
}

export function TrendDetailsSheet({
  open,
  onOpenChange,
  trendTitle,
  trendSummary,
  trendInterpretation,
  trendCategory,
  trendImpact,
  detailedResearch,
  sources = [],
}: TrendDetailsSheetProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    insights: true,
    business: false,
    market: false,
    implementation: false,
    evidence: false,
  })

  const accordionRefs = useRef<Record<string, HTMLDivElement | null>>({
    insights: null,
    business: null,
    market: null,
    implementation: null,
    evidence: null,
  })

  const brand = "#E0000A"

  const handleAccordionChange = (section: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: isExpanded,
    }))
  }

  // Component for rendering sources
  const SourcesSection = ({ sectionSources }: { sectionSources: string[] }) => (
    <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: "text.secondary",
          mb: 1.5,
          display: "block",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Sources
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {sectionSources.map((url, i) => (
          <Chip
            key={i}
            label={getSourceName(url)}
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            size="small"
            variant="outlined"
            sx={{
              color: brand,
              borderColor: `${brand}40`,
              fontSize: "0.75rem",
              height: 24,
              "&:hover": {
                backgroundColor: `${brand}08`,
                borderColor: brand,
              },
            }}
          />
        ))}
      </Stack>
    </Box>
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 lg:left-64 xl:left-72 bg-white z-50 flex flex-col h-screen">
      <div className="flex-shrink-0 bg-white">
        <div className="px-2 py-5 bg-white">
          <div className="h-16 flex items-center mb-4 relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-gray-600 absolute left-0"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <div className="flex-1 flex justify-center">
              <img
                src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/thryve_nav_logo.svg"
                alt="thryve"
                className="h-12"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pb-24">
          <div className="mb-6">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-2xl">
              <h1 className="text-2xl font-bold mb-3">{trendTitle}</h1>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label="Market Research"
                  size="small"
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontWeight: 500,
                  }}
                />
                <Chip
                  label="BPI Context"
                  size="small"
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontWeight: 500,
                  }}
                />
                <Chip
                  label="Philippines"
                  size="small"
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontWeight: 500,
                  }}
                />
              </Stack>
            </div>
          </div>

          {/* Key Insights & Business Implications */}
          <StyledAccordion
            ref={(el) => (accordionRefs.current.insights = el)}
            expanded={expandedSections.insights}
            onChange={handleAccordionChange("insights")}
            disableGutters={false}
          >
            <StyledAccordionSummary
              expandIcon={
                expandedSections.insights ? <Minus size={20} color={brand} /> : <Plus size={20} color={brand} />
              }
              onClick={(e) => {
                console.log("Summary clicked for insights")
                e.preventDefault()
                handleAccordionChange("insights")(e, !expandedSections.insights)
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Lightbulb size={20} color={brand} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: brand }}>
                  Key Insights & Business Implications
                </Typography>
              </Box>
            </StyledAccordionSummary>
            <AccordionDetails sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      color: brand,
                      mb: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Target size={16} />
                    Key Insight
                  </Typography>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-900 mb-1">Key Insight</p>
                    <p className="text-sm text-blue-800">
                      {trendSummary || "AI will summarize market validation here."}
                    </p>
                  </div>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      color: "#ED6C02",
                      mb: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <TrendingUp size={16} />
                    Business Implication
                  </Typography>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <p className="text-sm font-medium text-amber-900 mb-1">Business Implication</p>
                    <p className="text-sm text-amber-800">{trendInterpretation || "Insights will appear here."}</p>
                  </div>
                </Grid>
              </Grid>
              <SourcesSection sectionSources={getRandomSources(sources, 3)} />
            </AccordionDetails>
          </StyledAccordion>

          {/* Business Model */}
          <StyledAccordion
            ref={(el) => (accordionRefs.current.business = el)}
            expanded={expandedSections.business}
            onChange={handleAccordionChange("business")}
            disableGutters={false}
          >
            <StyledAccordionSummary
              expandIcon={
                expandedSections.business ? <Minus size={20} color={brand} /> : <Plus size={20} color={brand} />
              }
              onClick={(e) => {
                console.log("Summary clicked for business")
                e.preventDefault()
                handleAccordionChange("business")(e, !expandedSections.business)
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <DollarSign size={20} color={brand} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: brand }}>
                  Business Model & Strategic Alignment
                </Typography>
              </Box>
            </StyledAccordionSummary>
            <AccordionDetails sx={{ p: 3 }}>
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ p: 3, backgroundColor: "#f8f9fa", border: "1px solid #e9ecef" }}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: brand, mb: 2, display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <TrendingUp size={20} />
                      Business Impact Assessment
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={4}>
                        <Box
                          sx={{
                            p: 2,
                            backgroundColor: "rgba(76, 175, 80, 0.05)",
                            borderRadius: 2,
                            border: "1px solid rgba(76, 175, 80, 0.2)",
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#4CAF50", mb: 1 }}>
                            Customer Satisfaction Impact
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {detailedResearch?.businessImpact?.customerSatisfactionIncrease ||
                              generateBusinessImpactInsight("satisfaction", trendTitle, detailedResearch)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box
                          sx={{
                            p: 2,
                            backgroundColor: "rgba(33, 150, 243, 0.05)",
                            borderRadius: 2,
                            border: "1px solid rgba(33, 150, 243, 0.2)",
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#2196F3", mb: 1 }}>
                            Revenue Growth Potential
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {detailedResearch?.businessImpact?.revenueGrowthPotential ||
                              generateBusinessImpactInsight("revenue", trendTitle, detailedResearch)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box
                          sx={{
                            p: 2,
                            backgroundColor: "rgba(255, 152, 0, 0.05)",
                            borderRadius: 2,
                            border: "1px solid rgba(255, 152, 0, 0.2)",
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#FF9800", mb: 1 }}>
                            Market Coverage Expansion
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {detailedResearch?.businessImpact?.marketCoverageExpansion ||
                              generateBusinessImpactInsight("coverage", trendTitle, detailedResearch)}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              </Grid>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <MetricsPaper elevation={0}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: brand, mb: 2 }}>
                      Revenue Model
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
                      {detailedResearch?.businessModel?.revenueModel ||
                        "Revenue model analysis will appear here once research is complete."}
                    </Typography>

                    <Typography variant="h6" sx={{ fontWeight: 700, color: brand, mb: 2 }}>
                      Key Customer Segments
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                      {detailedResearch?.businessModel?.keyCustomers?.length > 0 ? (
                        detailedResearch.businessModel.keyCustomers.map((customer, index) => (
                          <Chip
                            key={index}
                            label={customer}
                            variant="outlined"
                            sx={{
                              borderColor: `${brand}40`,
                              color: "text.primary",
                              fontWeight: 500,
                            }}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                          Customer segments will be identified after analysis
                        </Typography>
                      )}
                    </Stack>

                    <Typography variant="h6" sx={{ fontWeight: 700, color: brand, mb: 2 }}>
                      BPI Strategic Alignment
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                      {detailedResearch?.businessModel?.bpiAlignment ||
                        "BPI alignment details will be available after strategic analysis."}
                    </Typography>
                  </MetricsPaper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid rgba(76, 175, 80, 0.2)" }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#4CAF50", mb: 2 }}>
                        Value Propositions
                      </Typography>
                      <List dense sx={{ py: 0 }}>
                        {detailedResearch?.businessModel?.valuePropositions?.length > 0 ? (
                          detailedResearch.businessModel.valuePropositions.map((prop, index) => (
                            <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                                <CheckCircle size={12} color="#4CAF50" style={{ marginTop: 4 }} />
                                <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                                  {prop}
                                </Typography>
                              </Box>
                            </ListItem>
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                            Value propositions will be defined after analysis
                          </Typography>
                        )}
                      </List>
                    </Paper>

                    <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid rgba(255, 152, 0, 0.2)" }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#FF9800", mb: 2 }}>
                        Key Partnerships
                      </Typography>
                      <List dense sx={{ py: 0 }}>
                        {detailedResearch?.businessModel?.keyPartnerships?.length > 0 ? (
                          detailedResearch.businessModel.keyPartnerships.map((partnership, index) => (
                            <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                                <Users size={12} color="#FF9800" style={{ marginTop: 4 }} />
                                <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                                  {partnership}
                                </Typography>
                              </Box>
                            </ListItem>
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                            Key partnerships will be identified after analysis
                          </Typography>
                        )}
                      </List>
                    </Paper>

                    <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid rgba(244, 67, 54, 0.2)" }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#F44336", mb: 2 }}>
                        Business Model Risks
                      </Typography>
                      <List dense sx={{ py: 0 }}>
                        {detailedResearch?.businessModel?.risks?.length > 0 ? (
                          detailedResearch.businessModel.risks.map((risk, index) => (
                            <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                                <AlertTriangle size={12} color="#F44336" style={{ marginTop: 4 }} />
                                <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                                  {risk}
                                </Typography>
                              </Box>
                            </ListItem>
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                            Risks will be assessed after analysis
                          </Typography>
                        )}
                      </List>
                    </Paper>

                    {detailedResearch?.businessModel?.riskMitigation?.length > 0 && (
                      <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid rgba(33, 150, 243, 0.2)" }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#2196F3", mb: 2 }}>
                          How to Address These Risks
                        </Typography>
                        <List dense sx={{ py: 0 }}>
                          {detailedResearch.businessModel.riskMitigation.map((mitigation, index) => (
                            <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                                <Shield size={12} color="#2196F3" style={{ marginTop: 4 }} />
                                <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                                  {mitigation}
                                </Typography>
                              </Box>
                            </ListItem>
                          ))}
                        </List>
                      </Paper>
                    )}
                  </Box>
                </Grid>
              </Grid>
              <SourcesSection sectionSources={getRandomSources(sources, 2)} />
            </AccordionDetails>
          </StyledAccordion>

          {/* Market Validation & Competitive Analysis */}
          <StyledAccordion
            ref={(el) => (accordionRefs.current.market = el)}
            expanded={expandedSections.market}
            onChange={handleAccordionChange("market")}
            disableGutters={false}
          >
            <StyledAccordionSummary
              expandIcon={
                expandedSections.market ? <Minus size={20} color={brand} /> : <Plus size={20} color={brand} />
              }
              onClick={(e) => {
                console.log("Summary clicked for market")
                e.preventDefault()
                handleAccordionChange("market")(e, !expandedSections.market)
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <BarChart3 size={20} color={brand} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: brand }}>
                  Market Validation & Competitive Analysis
                </Typography>
              </Box>
            </StyledAccordionSummary>
            <AccordionDetails sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, borderRadius: 2, backgroundColor: "rgba(33, 150, 243, 0.02)" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#2196F3", mb: 3 }}>
                      Market Validation
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Target Market Size
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.marketValidation?.targetMarketSize ||
                            "Market size data will be populated after analysis."}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Adoption Rate
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.marketValidation?.adoptionRate ||
                            "Adoption rate projections will be available after analysis."}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Revenue Opportunity
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.marketValidation?.revenueOpportunity ||
                            "Revenue opportunity estimates will be available after analysis."}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, borderRadius: 2, backgroundColor: "rgba(156, 39, 176, 0.02)" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#9C27B0", mb: 3 }}>
                      Competitive Analysis
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Current State
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.competitiveAnalysis?.currentState ||
                            "Current state of the market will be available after analysis."}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          BPI Position
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.competitiveAnalysis?.bpiPosition ||
                            "BPI's position in the market will be available after analysis."}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Market Window
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.competitiveAnalysis?.marketWindow ||
                            "Market window analysis will be available after analysis."}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Key Competitors
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                          {detailedResearch?.competitiveAnalysis?.competitors?.map((competitor, index) => (
                            <Chip
                              key={index}
                              label={competitor}
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: "#9C27B0", color: "#9C27B0" }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
              <SourcesSection sectionSources={getRandomSources(sources, 2)} />
            </AccordionDetails>
          </StyledAccordion>

          {/* Implementation & Success Metrics */}
          <StyledAccordion
            ref={(el) => (accordionRefs.current.implementation = el)}
            expanded={expandedSections.implementation}
            onChange={handleAccordionChange("implementation")}
            disableGutters={false}
          >
            <StyledAccordionSummary
              expandIcon={
                expandedSections.implementation ? <Minus size={20} color={brand} /> : <Plus size={20} color={brand} />
              }
              onClick={(e) => {
                console.log("Summary clicked for implementation")
                e.preventDefault()
                handleAccordionChange("implementation")(e, !expandedSections.implementation)
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Shield size={20} color={brand} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: brand }}>
                  Implementation & Success Metrics
                </Typography>
              </Box>
            </StyledAccordionSummary>
            <AccordionDetails sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, borderRadius: 2, backgroundColor: "rgba(255, 193, 7, 0.02)" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#FFC107", mb: 3 }}>
                      Implementation Details
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Technical Requirements
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.implementationDetails?.technicalRequirements ||
                            "Technical requirements will be available after analysis."}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Development Time
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.implementationDetails?.developmentTime ||
                            "Development time estimates will be available after analysis."}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Investment Needed
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.implementationDetails?.investmentNeeded ||
                            "Investment needed estimates will be available after analysis."}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Risk Factors
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                          {detailedResearch?.implementationDetails?.riskFactors?.map((risk, index) => (
                            <Chip
                              key={index}
                              label={risk}
                              size="small"
                              sx={{ backgroundColor: "#FFEBEE", color: "#D32F2F" }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, borderRadius: 2, backgroundColor: "rgba(76, 175, 80, 0.02)" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#4CAF50", mb: 3 }}>
                      Success Metrics
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Target KPIs
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                          {detailedResearch?.successMetrics?.targetKPIs?.map((kpi, index) => (
                            <Chip
                              key={index}
                              label={kpi}
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: "#4CAF50", color: "#4CAF50" }}
                            />
                          ))}
                        </Stack>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          Pilot Strategy
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.successMetrics?.pilotStrategy ||
                            "Pilot strategy details will be available after analysis."}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                          ROI Timeline
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {detailedResearch?.successMetrics?.roiTimeline ||
                            "ROI timeline projections will be available after analysis."}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
              <SourcesSection sectionSources={getRandomSources(sources, 2)} />
            </AccordionDetails>
          </StyledAccordion>

          {/* Supporting Evidence */}
          <StyledAccordion
            ref={(el) => (accordionRefs.current.evidence = el)}
            expanded={expandedSections.evidence}
            onChange={handleAccordionChange("evidence")}
            disableGutters={false}
          >
            <StyledAccordionSummary
              expandIcon={
                expandedSections.evidence ? <Minus size={20} color={brand} /> : <Plus size={20} color={brand} />
              }
              onClick={(e) => {
                console.log("Summary clicked for evidence")
                e.preventDefault()
                handleAccordionChange("evidence")(e, !expandedSections.evidence)
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <FileText size={20} color={brand} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: brand }}>
                  Supporting Evidence & Context
                </Typography>
              </Box>
            </StyledAccordionSummary>
            <AccordionDetails sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 3, borderRadius: 2, height: "100%" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: brand, mb: 2 }}>
                      Case Studies
                    </Typography>
                    <List dense sx={{ py: 0 }}>
                      {detailedResearch?.supportingEvidence?.caseStudies?.map((cs, i) => (
                        <ListItem key={i} sx={{ py: 0.5, px: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                            <FileText size={12} color={brand} style={{ marginTop: 4 }} />
                            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                              {cs}
                            </Typography>
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 3, borderRadius: 2, height: "100%" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: brand, mb: 2 }}>
                      Local Context
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <MapPin size={16} color={brand} style={{ marginTop: 2 }} />
                      <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                        {detailedResearch?.supportingEvidence?.localContext ||
                          "Local context details will be available after analysis."}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 3, borderRadius: 2, height: "100%" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: brand, mb: 2 }}>
                      Regulatory Considerations
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Shield size={16} color={brand} style={{ marginTop: 2 }} />
                      <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                        {detailedResearch?.supportingEvidence?.regulatory ||
                          "Regulatory considerations will be available after analysis."}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
              <SourcesSection sectionSources={getRandomSources(sources, 3)} />
            </AccordionDetails>
          </StyledAccordion>

          {/* All Sources */}
          {sources.length > 0 && (
            <Paper sx={{ p: 3, borderRadius: 2, mt: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: brand, mb: 2 }}>
                Research Sources
              </Typography>
              <Grid container spacing={1}>
                {sources.map((url, i) => (
                  <Grid item xs={12} sm={6} md={4} key={i}>
                    <Chip
                      label={getSourceName(url)}
                      component="a"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                      variant="outlined"
                      sx={{
                        width: "100%",
                        justifyContent: "flex-start",
                        color: brand,
                        borderColor: `${brand}40`,
                        "&:hover": {
                          backgroundColor: `${brand}08`,
                          borderColor: brand,
                        },
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}
        </div>
      </div>
    </div>
  )
}

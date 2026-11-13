/**
 * Loose types for the parts of a Find a Tender OCDS release that we read.
 * Every field is optional: the feed mixes Procurement Act 2023 notices (UK1–UK16)
 * with legacy notices that carry a different subset of fields. See
 * docs/domain/fts-data-profile.md for measured presence rates.
 */
export type OcdsValue = { amount?: number | null; amountGross?: number | null; currency?: string | null };
export type OcdsPeriod = {
  startDate?: string | null;
  endDate?: string | null;
  maxExtentDate?: string | null;
  durationInDays?: number | null;
};
export type OcdsClassification = { scheme?: string | null; id?: string | null; description?: string | null };
export type OcdsAddress = {
  streetAddress?: string | null;
  locality?: string | null;
  postalCode?: string | null;
  country?: string | null;
  countryName?: string | null;
  region?: string | null;
};
export type OcdsItem = {
  id?: string;
  classification?: OcdsClassification | null;
  additionalClassifications?: OcdsClassification[] | null;
  deliveryAddresses?: OcdsAddress[] | null;
  relatedLot?: string | null;
};
export type OcdsDocument = {
  id?: string;
  documentType?: string | null;
  noticeType?: string | null;
  url?: string | null;
  datePublished?: string | null;
};
export type OcdsCriterion = {
  type?: string | null;
  name?: string | null;
  description?: string | null;
  numbers?: Array<{ number?: number | null; weight?: string | null }> | null;
};
export type OcdsLot = {
  id?: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  value?: OcdsValue | null;
  contractPeriod?: OcdsPeriod | null;
  hasRenewal?: boolean | null;
  suitability?: { sme?: boolean | null; vcse?: boolean | null } | null;
  awardCriteria?: { description?: string | null; weightingDescription?: string | null; criteria?: OcdsCriterion[] | null } | null;
};
export type OcdsParty = {
  id?: string;
  name?: string | null;
  identifier?: { scheme?: string | null; id?: string | null; legalName?: string | null } | null;
  additionalIdentifiers?: Array<{ scheme?: string | null; id?: string | null }> | null;
  address?: OcdsAddress | null;
  contactPoint?: { name?: string | null; email?: string | null; telephone?: string | null; url?: string | null } | null;
  roles?: string[] | null;
  details?: {
    url?: string | null;
    scale?: string | null;
    vcse?: boolean | null;
    classifications?: OcdsClassification[] | null;
  } | null;
};
export type OcdsOrgRef = { id?: string | null; name?: string | null };
export type OcdsAward = {
  id?: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  date?: string | null;
  value?: OcdsValue | null;
  suppliers?: OcdsOrgRef[] | null;
  items?: OcdsItem[] | null;
  relatedLots?: string[] | null;
  contractPeriod?: OcdsPeriod | null;
  hasRenewal?: boolean | null;
  mainProcurementCategory?: string | null;
  aboveThreshold?: boolean | null;
  documents?: OcdsDocument[] | null;
};
export type OcdsContract = {
  id?: string;
  awardID?: string | null;
  title?: string | null;
  status?: string | null;
  value?: OcdsValue | null;
  dateSigned?: string | null;
  period?: OcdsPeriod | null;
  hasRenewal?: boolean | null;
  aboveThreshold?: boolean | null;
  items?: OcdsItem[] | null;
  documents?: OcdsDocument[] | null;
  implementation?: { endDate?: string | null } | null;
};
export type OcdsTender = {
  id?: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  legalBasis?: { id?: string | null; scheme?: string | null } | null;
  classification?: OcdsClassification | null;
  items?: OcdsItem[] | null;
  lots?: OcdsLot[] | null;
  value?: OcdsValue | null;
  procurementMethod?: string | null;
  procurementMethodDetails?: string | null;
  mainProcurementCategory?: string | null;
  aboveThreshold?: boolean | null;
  specialRegime?: string[] | null;
  tenderPeriod?: OcdsPeriod | null;
  enquiryPeriod?: OcdsPeriod | null;
  expressionOfInterestDeadline?: string | null;
  communication?: { futureNoticeDate?: string | null } | null;
  techniques?: { hasFrameworkAgreement?: boolean | null; hasDynamicPurchasingSystem?: boolean | null } | null;
  documents?: OcdsDocument[] | null;
  submissionMethodDetails?: string | null;
};
export type OcdsRelease = {
  ocid?: string;
  id?: string;
  date?: string;
  tag?: string[] | null;
  description?: string | null;
  tender?: OcdsTender | null;
  planning?: {
    documents?: OcdsDocument[] | null;
    milestones?: Array<{ type?: string | null; dueDate?: string | null; status?: string | null }> | null;
  } | null;
  awards?: OcdsAward[] | null;
  contracts?: OcdsContract[] | null;
  parties?: OcdsParty[] | null;
  buyer?: OcdsOrgRef | null;
  relatedProcesses?: Array<{ relationship?: string[] | null; scheme?: string | null; identifier?: string | null }> | null;
};
export type OcdsReleasePackage = { releases?: OcdsRelease[]; links?: { next?: string | null } | null };

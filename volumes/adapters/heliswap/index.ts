import { SimpleVolumeAdapter } from "../../dexVolume.type";
import { CHAIN } from "../../helper/chains";
import { getUniqStartOfTodayTimestamp } from "../../helper/getUniSubgraphVolume";
import axios from "axios";

const urlConfigs = {
  graphQLUrl: "https://heliswap-prod-362307.oa.r.appspot.com/query",
  tokenListUrl: "https://heliswap-api.ey.r.appspot.com/tokens/whitelisted/",
};

const axiosConfig = {
  url: urlConfigs.graphQLUrl,
  method: "post",
};

const getWhitelistedTokenAddresses = async () => {
  const response = await axios(urlConfigs.tokenListUrl);
  const { data: whitelistedTokens } = response;

  return whitelistedTokens;
};

const fetch = async (timestamp: number) => {
  const dayTimestamp = getUniqStartOfTodayTimestamp(new Date(timestamp * 1000));
  const whitelistedAddresses = await getWhitelistedTokenAddresses();

  const { url, method } = axiosConfig;
  const request24hPoolsData = {
    query: `query getWhitelistedPools($tokens: [String]!) {
                poolsConsistingOf(tokens: $tokens) {
                  volume24hUsd
                }
              }`,
    variables: {
      tokens: whitelistedAddresses,
    },
  };

  const requestHistoricalVolumeData = {
    query: `query {
      getMetrics {
        volume
      }
    }`,
  };

  const requestObjectPoolsData = {
    url,
    method,
    data: request24hPoolsData,
  };

  const requestObjectHistoricalVolumeData = {
    url,
    method,
    data: requestHistoricalVolumeData,
  };

  const responsePoolsDataPromise = axios(requestObjectPoolsData);
  const responseHistoricalVolumeDataPromise = axios(
    requestObjectHistoricalVolumeData
  );

  const result = await Promise.all([
    responsePoolsDataPromise,
    responseHistoricalVolumeDataPromise,
  ]);

  const responsePoolsData = result[0];
  const responseHistoricalVolumeData = result[1];

  const {
    data: { data: poolsData },
  } = responsePoolsData;

  const {
    data: { data: historicalData },
  } = responseHistoricalVolumeData;

  const accumulated24hPoolsVolume =
    poolsData &&
    poolsData.poolsConsistingOf &&
    poolsData.poolsConsistingOf?.length > 0
      ? poolsData.poolsConsistingOf.reduce(
          (acc: number, pool: { volume24hUsd: string }) => {
            acc += Number(pool.volume24hUsd);
            return acc;
          },
          0
        )
      : 0;

  const accumulatedVolume =
    historicalData &&
    historicalData.getMetrics &&
    historicalData.getMetrics?.length > 0
      ? historicalData.getMetrics.reduce(
          (acc: number, dayValue: { volume: string }) => {
            acc += Number(dayValue.volume);
            return acc;
          },
          0
        )
      : 0;

  return {
    totalVolume: accumulatedVolume.toString(),
    dailyVolume: accumulated24hPoolsVolume.toString(),
    timestamp: dayTimestamp,
  };
};

const adapter: SimpleVolumeAdapter = {
  volume: {
    [CHAIN.HEDERA]: {
      fetch,
      start: async () => 1665142669,
    },
  },
};

export default adapter;

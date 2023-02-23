import { initializeConnector } from '@web3-react/core'
import { MetaMask } from '@web3-react/metamask'

interface BitKeepEthereumProvider {
  isBitKeep?: boolean;
  once(eventName: string | symbol, listener: (...args: any[]) => void): this;
  on(eventName: string | symbol, listener: (...args: any[]) => void): this;
  off(eventName: string | symbol, listener: (...args: any[]) => void): this;
  addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string | symbol): this;
}
interface Window {
  bitkeep?: {
    ethereum?: BitKeepEthereumProvider;
  }
}


function detectEthereumProvider<T = BitKeepEthereumProvider>({
  mustBeBitKeep = false,
  silent = false,
  timeout = 3000,
} = {}): Promise<T | null> {

  _validateInputs();

  let handled = false;

  return new Promise((resolve) => {
    if ((window as Window)?.bitkeep?.ethereum) {

      handleEthereum();

    } else {

      window.addEventListener(
        'ethereum#initialized',
        handleEthereum,
        { once: true },
      );

      setTimeout(() => {
        handleEthereum();
      }, timeout);
    }

    function handleEthereum() {

      if (handled) {
        return;
      }
      handled = true;

      window.removeEventListener('ethereum#initialized', handleEthereum);

      const { bitkeep } = (window as Window);

      if (bitkeep?.ethereum && (!mustBeBitKeep ||bitkeep. ethereum.isBitKeep)) {
        resolve(bitkeep.ethereum as unknown as T);
      } else {

        const message = mustBeBitKeep && bitkeep?.ethereum
          ? 'Non-BitKeep window.bitkeep.ethereum detected.'
          : 'Unable to detect window.bitkeep.ethereum.';

        !silent && console.error('detect-provider:', message);
        resolve(null);
      }
    }
  });

  function _validateInputs() {
    if (typeof mustBeBitKeep !== 'boolean') {
      throw new Error(`detect-provider: Expected option 'mustBeBitKeep' to be a boolean.`);
    }
    if (typeof silent !== 'boolean') {
      throw new Error(`detect-provider: Expected option 'silent' to be a boolean.`);
    }
    if (typeof timeout !== 'number') {
      throw new Error(`detect-provider: Expected option 'timeout' to be a number.`);
    }
  }
}

function parseChainId(chainId: string) {
    return Number.parseInt(chainId, 16)
}
  

export class BitKeep  extends MetaMask {
    private provider
    private options
    private eagerConnection?: Promise<void>
    async isomorphicInitialize(): Promise<void> {
        if (this.eagerConnection) return

        return this.eagerConnection = (async ()=>{
            const provider = await detectEthereumProvider(this.options)
            if (provider) {
                this.provider = provider 

                // handle the case when e.g. metamask and coinbase wallet are both installed
                if (this.provider.providers?.length) {
                    this.provider = this.provider.providers.find((p) => p.isMetaMask) ?? this.provider.providers[0]
                }

                this.provider.on('connect', ({ chainId }): void => {
                    this.actions.update({ chainId: parseChainId(chainId) })
                })

                this.provider.on('disconnect', (error): void => {
                    // 1013 indicates that MetaMask is attempting to reestablish the connection
                    // https://github.com/MetaMask/providers/releases/tag/v8.0.0
                    if (error.code === 1013) {
                        console.debug('MetaMask logged connection error 1013: "Try again later"')
                        return
                    }
                    this.actions.resetState()
                    this.onError?.(error)
                })

                this.provider.on('chainChanged', (chainId: string): void => {
                    this.actions.update({ chainId: parseChainId(chainId) })
                })

                this.provider.on('accountsChanged', (accounts: string[]): void => {
                    if (accounts.length === 0) {
                        // handle this edge case by disconnecting
                        this.actions.resetState()
                    } else {
                        this.actions.update({ accounts })
                    }
                })
            }
        })() 
    }
}


export const [bitkeep, hooks] = initializeConnector<BitKeep>((actions) => new BitKeep({ actions }))

import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        'auto-rotate'?: boolean | string;
        'camera-controls'?: boolean;
        'shadow-intensity'?: string;
        'shadow-softness'?: string;
        loading?: string;
        reveal?: string;
        poster?: string;
        'environment-image'?: string;
        'exposure'?: string;
        'pan'?: string;
        'radius'?: string;
        'min-camera-orbit'?: string;
        'max-camera-orbit'?: string;
        'camera-orbit'?: string;
        'field-of-view'?: string;
        'max-fov'?: string;
        'min-fov'?: string;
        'azimuth-angle'?: string;
        'polar-angle'?: string;
        'theta-length'?: string;
        'interaction-prompt'?: string;
        'interaction-prompt-threshold'?: string;
        'unmarshal-disabled'?: boolean;
        'no-ui'?: boolean;
      }, HTMLElement>;
    }
  }
}

export {};
